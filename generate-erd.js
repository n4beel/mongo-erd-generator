const { MongoClient, ObjectId } = require('mongodb');

async function generateMermaidERD(config) {
    const client = new MongoClient(config.url);
    const collectionSchemas = {};

    try {
        await client.connect();
        const db = client.db(config.dbName);
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name).filter(n => !n.startsWith('system.'));

        console.log(`\n📊 Analyzing ${collectionNames.length} collections...`);

        // Step 1: Build schemas for all collections
        for (const col of collections) {
            const name = col.name;
            if (name.startsWith('system.')) continue;

            console.log(`  Analyzing schema: ${name}`);
            const cursor = db.collection(name).find({}).limit(100);
            const docs = await cursor.toArray();

            const schema = {};
            for (const doc of docs) {
                analyzeDocSchema(doc, schema);
            }

            collectionSchemas[name] = schema;
        }

        // Step 2: Build ObjectId index (new advanced detection)
        console.log(`\n🔗 Building ObjectId relationship index...`);
        const objectIdIndex = await buildObjectIdIndex(db, collectionNames, 100);

        // Step 3: Detect relationships using ObjectId matching
        console.log(`  Detecting relationships...`);
        const relationships = detectObjectIdRelationships(objectIdIndex);

        // Step 4: Detect junction tables
        const junctionTables = detectJunctionTables(relationships, collectionSchemas);

        console.log(`\n✅ Found ${relationships.length} relationships`);
        console.log(`✅ Found ${junctionTables.size} junction tables`);

        // Step 5: Generate Mermaid output
        let output = 'erDiagram\n';

        // Print Entities
        for (const [colName, fields] of Object.entries(collectionSchemas)) {
            const safeEntityName = toSafeId(colName);
            const entityHeader = safeEntityName !== colName
                ? `${safeEntityName}["${colName}"]`
                : safeEntityName;

            output += `    ${entityHeader} {\n`;
            for (const [fieldName, type] of Object.entries(fields)) {
                if (!fieldName.trim()) continue;
                output += `        ${sanitizeType(type)} ${sanitizeField(fieldName)}\n`;
            }
            output += `    }\n`;
        }

        // Print Relationships (new format with cardinality)
        const mermaidRels = relationshipsToMermaid(relationships, junctionTables);
        for (const rel of mermaidRels) {
            output += `${rel}\n`;
        }

        return output;

    } catch (err) {
        console.error('Error generating ERD:', err);
        return `erDiagram\n    ERROR { string message "Check console logs" }`;
    } finally {
        await client.close();
    }
}

function toSafeId(str) {
    // Mermaid entity names must be alphanumeric + underscore
    return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeType(str) {
    if (!str) return 'Unknown';
    // Replace < > with ~ for Mermaid generics
    return str.replace(/</g, '~').replace(/>/g, '~');
}

function sanitizeField(str) {
    if (!str) return 'Unknown';

    // Replace dots and other problematic characters with underscores
    // Mermaid ERD doesn't accept dots even in quoted field names
    str = str.replace(/[.]/g, '_');

    // If simple alphanumeric + underscore, return as is
    if (/^[a-zA-Z0-9_]+$/.test(str)) {
        return str;
    }

    // Replace remaining special characters with underscores
    str = str.replace(/[^a-zA-Z0-9_]/g, '_');

    return str;
}

function analyzeDocSchema(doc, schema, prefix = '') {
    for (const [key, value] of Object.entries(doc)) {
        if (!key) continue; // Skip empty keys
        const fullKey = prefix ? `${prefix}.${key}` : key;

        // Skip purely internal fields if desired, but keeping them for now usually safe
        // if (key.startsWith('__')) continue; 

        let type = 'String'; // Default

        if (value === null || value === undefined) {
            // Keep existing type if we already found one, otherwise Unknown
            if (!schema[fullKey]) type = 'Unknown';
            else type = schema[fullKey];
        } else if (value instanceof ObjectId || value._bsontype === 'ObjectID') {
            type = 'ObjectId';
        } else if (value instanceof Date) {
            type = 'Date';
        } else if (typeof value === 'number') {
            type = 'Number';
        } else if (typeof value === 'boolean') {
            type = 'Boolean';
        } else if (Array.isArray(value)) {
            // Array handling
            if (value.length > 0) {
                const first = value[0];
                if (first instanceof ObjectId || first?._bsontype === 'ObjectID') {
                    type = 'Array<ObjectId>';
                } else if (typeof first === 'object' && first !== null) {
                    type = 'Array<Object>';
                    // Optionally recurse into array objects? complicated for ERD.
                    // keeping simple for now
                } else {
                    type = `Array<${typeof first}>`;
                }
            } else {
                type = 'Array';
            }
        } else if (typeof value === 'object') {
            // Nested Object -> Flatten with dot notation
            // Recurse
            analyzeDocSchema(value, schema, fullKey);
            continue; // Skip setting schema[fullKey] = 'Object', we want flattened keys
        }

        // Upsert type into schema (if new or more specific)
        if (!schema[fullKey] || schema[fullKey] === 'Unknown') {
            schema[fullKey] = type;
        }
    }
}

// ==========================================
// ADVANCED OBJECTID-BASED RELATIONSHIP DETECTION
// ==========================================

/**
 * Build an index of all ObjectId values across collections
 * Returns: { collectionName: { fieldPath: { objectIds: Set, isArray: bool } } }
 */
async function buildObjectIdIndex(db, collections, sampleSize = 100) {
    const index = {};

    for (const collectionName of collections) {
        console.log(`  Indexing ObjectIds in ${collectionName}...`);
        const collection = db.collection(collectionName);
        const docs = await collection.find({}).limit(sampleSize).toArray();

        index[collectionName] = extractObjectIdFields(docs);
    }

    return index;
}

/**
 * Extract all ObjectId fields from documents
 * Returns: { fieldPath: { objectIds: Set, isArray: bool, count: number } }
 */
function extractObjectIdFields(docs, prefix = '') {
    const fieldMap = {};

    for (const doc of docs) {
        traverseForObjectIds(doc, prefix, fieldMap);
    }

    return fieldMap;
}

/**
 * Recursively traverse document to find ObjectId fields (including string-based ones)
 */
function traverseForObjectIds(obj, prefix, fieldMap) {
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('__')) continue;

        const fullPath = prefix ? `${prefix}.${key}` : key;

        // Direct ObjectId
        if (value instanceof ObjectId || value?._bsontype === 'ObjectID') {
            if (!fieldMap[fullPath]) {
                fieldMap[fullPath] = { objectIds: new Set(), isArray: false, count: 0 };
            }
            fieldMap[fullPath].objectIds.add(value.toString());
            fieldMap[fullPath].count++;
        }
        // String that looks like an ObjectId (24 hex characters)
        else if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) {
            if (!fieldMap[fullPath]) {
                fieldMap[fullPath] = { objectIds: new Set(), isArray: false, count: 0 };
            }
            fieldMap[fullPath].objectIds.add(value);
            fieldMap[fullPath].count++;
        }
        // Array of ObjectIds (or strings that look like ObjectIds)
        else if (Array.isArray(value)) {
            const objectIds = value.filter(v => {
                if (v instanceof ObjectId || v?._bsontype === 'ObjectID') return true;
                if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) return true;
                return false;
            });

            if (objectIds.length > 0) {
                if (!fieldMap[fullPath]) {
                    fieldMap[fullPath] = { objectIds: new Set(), isArray: true, count: 0 };
                }
                objectIds.forEach(id => {
                    const idStr = id instanceof ObjectId ? id.toString() : id;
                    fieldMap[fullPath].objectIds.add(idStr);
                    fieldMap[fullPath].count++;
                });
            } else if (value.length > 0 && typeof value[0] === 'object') {
                // Don't recurse into array items - we treat the array as a whole
                // Skip indexed traversal to avoid participants[0]._id, participants[1]._id
            }
        }
        // Nested object (but not Date, not Array)
        else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
            traverseForObjectIds(value, fullPath, fieldMap);
        }
    }
}

/**
 * Detect relationships by matching ObjectIds across collections
 */
function detectObjectIdRelationships(objectIdIndex) {
    const relationships = [];

    // For each collection and field that contains ObjectIds
    for (const [sourceCol, sourceFields] of Object.entries(objectIdIndex)) {
        for (const [sourceField, sourceData] of Object.entries(sourceFields)) {
            // Skip _id fields (we're looking for references TO _id, not FROM _id)
            if (sourceField === '_id') continue;

            // Check against every other collection's _id field
            for (const [targetCol, targetFields] of Object.entries(objectIdIndex)) {
                if (!targetFields['_id']) continue;

                const targetIds = targetFields['_id'].objectIds;
                const sourceIds = sourceData.objectIds;

                // Find intersection
                const matches = new Set([...sourceIds].filter(id => targetIds.has(id)));

                if (matches.size > 0) {
                    // Calculate confidence (what % of source IDs match target)
                    const confidence = matches.size / sourceIds.size;

                    // Determine cardinality
                    const cardinality = determineCardinality(
                        sourceData,
                        targetFields['_id'],
                        matches,
                        sourceCol === targetCol
                    );

                    relationships.push({
                        from: sourceCol,
                        fromField: sourceField,
                        to: targetCol,
                        toField: '_id',
                        cardinality: cardinality,
                        matchCount: matches.size,
                        confidence: confidence.toFixed(2),
                        isSelfReference: sourceCol === targetCol
                    });
                }
            }
        }
    }

    return relationships;
}

/**
 * Determine relationship cardinality
 */
function determineCardinality(sourceData, targetData, matches, isSelfRef) {
    const { isArray: sourceIsArray, count: sourceCount, objectIds: sourceIds } = sourceData;

    // Many-to-Many: Source field is an array of ObjectIds
    if (sourceIsArray) {
        return 'many-to-many';
    }

    // Check if source has duplicate ObjectIds (multiple docs pointing to same target)
    const uniqueSourceIds = sourceIds.size;
    const totalSourceCount = sourceCount;
    const hasDuplicates = totalSourceCount > uniqueSourceIds;

    if (hasDuplicates) {
        // One-to-Many: Multiple source documents reference the same target
        return 'one-to-many';
    } else {
        // One-to-One: Each source document references a unique target
        return 'one-to-one';
    }
}

/**
 * Detect junction tables (collections used primarily for M:M relationships)
 */
function detectJunctionTables(relationships, collectionSchemas) {
    const junctionTables = new Set();

    // Group relationships by source collection
    const relsBySource = {};
    for (const rel of relationships) {
        if (!relsBySource[rel.from]) {
            relsBySource[rel.from] = [];
        }
        relsBySource[rel.from].push(rel);
    }

    // A junction table typically:
    // 1. Has 2+ ObjectId foreign keys
    // 2. Has few other fields (< 5 typically)
    // 3. Primary purpose is linking
    for (const [collectionName, rels] of Object.entries(relsBySource)) {
        const objectIdFieldCount = rels.length;
        const totalFieldCount = Object.keys(collectionSchemas[collectionName] || {}).length;

        // Heuristic: If 2+ ObjectId refs and <= 5 total fields
        if (objectIdFieldCount >= 2 && totalFieldCount <= 5) {
            junctionTables.add(collectionName);
        }
    }

    return junctionTables;
}

/**
 * Convert relationships to Mermaid ER diagram syntax
 */
function relationshipsToMermaid(relationships, junctionTables) {
    const mermaidRels = new Set();

    for (const rel of relationships) {
        const fromEntity = toSafeId(rel.from);
        const toEntity = toSafeId(rel.to);
        const fieldLabel = sanitizeField(rel.fromField);

        // Choose Mermaid cardinality notation
        let notation;
        if (rel.cardinality === 'one-to-one') {
            notation = `||--||`; // One-to-One
        } else if (rel.cardinality === 'one-to-many') {
            notation = `||--o{`; // One-to-Many
        } else { // many-to-many
            notation = `}o--o{`; // Many-to-Many
        }

        // Add junction table indicator if applicable
        const isJunction = junctionTables.has(rel.from) ? ' [junction]' : '';

        mermaidRels.add(`    ${toEntity} ${notation} ${fromEntity} : \"${fieldLabel}${isJunction}\"`);
    }

    return Array.from(mermaidRels);
}


module.exports = { generateMermaidERD };
