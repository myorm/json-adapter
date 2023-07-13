// @ts-check
// the JSON adapter is much different from other adapters, as a command and respective arguments aren't used, everything is done within this program rather than
// being expected to be sent to a database server. Therefore, many of the types will be casted and what is returned from each of the serialization functions
// will not reflect what would actually be sent.

/**
 * Structure for a model that needs to be passed into the adapter when instantiating a `MyORMContext` class object connected to the `json-adapter`.
 * @typedef {object} JsonDatabase
 * @prop {Record<string, Record<string, import("@myorm/myorm").DescribedSchema>>} $schema
 * Schema of the database
 * @prop {Record<string, import("@myorm/myorm").SqlTable[]>} $data
 * Actual data itself, stored as an array of objects representing the corresponding schema for the table.
 */

/**
 * Uses `MyORM`'s WHERE clause properties (built from `.where()`) to recursively check if the object should stay or not within the context of the "command".  
 * Unlike SQL, this function short circuits if an OR condition has been met and the last condition was true (or if an AND condition is met and the last condition was false)
 * @param {any} m
 * Model that is being checked if it should stay in the array.
 * @param {any} props
 * Properties that are being checked for filtering (this is received from `MyORM`'s where clause built)
 * @prop {boolean} stays
 * Boolean handled recursively to keep track of whether the object should stay or not.
 */
function filterFn(m, props, stays=true) {
    if(props) {
        for(const prop of props) {
            // short circuit
            if(!stays && (prop.chain === "WHERE" || prop.chain === "WHERE NOT" || prop.chain === "AND" || prop.chain === "AND NOT")) {
                return stays;
            }
            if(stays && (prop.chain === "OR" || prop.chain === "OR NOT")) {
                return stays;
            }
            if(Array.isArray(prop)) {
                stays = filterFn(m, prop, stays);
            } else {
                switch(prop.operator) {
                    case "<": {
                        if(prop.value === null) {
                            stays = false;
                            break;
                        }
                        stays = m[prop.property] < prop.value;
                        break;
                    }
                    case "<=": {
                        if(prop.value === null) {
                            stays = false;
                            break;
                        }
                        stays = m[prop.property] <= prop.value;
                        break;
                    }
                    case ">": {
                        if(prop.value === null) {
                            stays = false;
                            break;
                        }
                        stays = m[prop.property] > prop.value;
                        break;
                    }
                    case ">=": {
                        if(prop.value === null) {
                            stays = false;
                            break;
                        }
                        stays = m[prop.property] >= prop.value;
                        break;
                    }
                    case "<>": {
                        stays = m[prop.property] !== prop.value;
                        break;
                    }
                    case "=": {
                        stays = m[prop.property] === prop.value;
                        break;
                    }
                    case "BETWEEN": {
                        if(prop.value === null) {
                            stays = false;
                            break;
                        }
                        stays = m[prop.property] <= prop.value && m[prop.property] >= prop.value;
                        break;
                    }
                    case "IN": {
                        if(prop.value === null || !Array.isArray(prop.value)) {
                            stays = false;
                            break;
                        }
                        stays = prop.value.includes(m[prop.property]);
                        break;
                    }
                    case "IS": {
                        stays = m[prop.property] === null;
                        break;
                    }
                    case "IS NOT": {
                        stays = m[prop.property] !== null;
                        break;
                    }
                    case "LIKE": {
                        if(prop.value === null || typeof prop.value !== "string") {
                            stays = false;
                            break;
                        }
                        stays = new RegExp(prop.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\%/g, ".*"), "g").test(m[prop.property]);
                        break;
                    }
                }
            }
        }
        return stays;
    }
    return true;
};

/** 
 * Adapter for `MyORM` with intended use on JavaScript objects.
 * @type {import('@myorm/myorm').InitializeAdapterCallback<JsonDatabase>} 
 */
export function adapter(config) {
    return {
        options: { },
        syntax: {
            escapeColumn: (s) => s,
            escapeTable: (s) => s
        },
        execute(scope) {
            return {
                async forQuery(cmd, args) {
                    return /** @type {any} */ (args);
                },
                async forCount(cmd, args) {
                    return /** @type {any} */ (args[0]);
                },
                async forInsert(cmd, args) {
                    const [affectedRows, insertId] = args;
                    return Array.from(Array(affectedRows).keys()).map((_, n) => n + /** @type {number}*/ (insertId));
                },
                async forUpdate(cmd, args) {
                    return /** @type {any} */ (args[0]);
                },
                async forDelete(cmd, args) {
                    return /** @type {any} */ (args[0]);
                },
                async forTruncate(cmd, args) {
                    return /** @type {any} */ (args[0]);
                },
                async forDescribe(cmd, args) {
                    return /** @type {any} */ (args);
                },
                async forConstraints(cmd, args) {
                    return [];
                }
            }
        },
        serialize({ ErrorTypes, MyORMAdapterError }) {
            return {
                forQuery(data) {
                    let { where, group_by, order_by, limit, offset, select, from } = data;
                    let [mainTable, ...remainingTables] = from;
                    
                    // @TODO: apply from (look for like primary keys then map property names to the aliased versions.)


                    // apply where
                    /** @type {any[]} */
                    let results = config.$data[mainTable.table].filter(v => filterFn(v, where));

                    // apply group by
                    if(group_by) {
                        // (group first)
                        results = results.map(r => {
                            if(!group_by) return r;
                            let o = {};
                            for(const column of group_by) {
                                o[column.alias] = r[column.alias];
                            }
                            return o;
                        });

                        results = results.filter((r,n,self) => {
                            const idx = self.findIndex(m => {
                                if(!group_by) return false;
                                for(const column of group_by) {
                                    if(r[column.alias] !== m[column.alias]) return false;
                                }
                                return true;
                            });
                            return idx !== -1 && idx === n;
                        });
                    }

                    // apply sort by
                    if(order_by) {
                        for(const prop of order_by) {
                            results = results.sort((a,b) => {
                                if(prop.direction === "DESC") {
                                    [b,a] = [a,b];
                                }
                                switch(typeof a[prop.alias]) {
                                        case "string": {
                                            return a[prop.alias].localeCompare(b[prop.alias]);
                                        }
                                        case "boolean": {
                                            return a[prop.alias] - b[prop.alias];
                                        }
                                        case "object": {
                                            if(a[prop.alias] instanceof Date) {
                                                return a[prop.alias].getTime() - b[prop.alias].getTime();
                                            } else {
                                                throw MyORMAdapterError("Unexpected data type.");
                                            }
                                        }
                                        case "bigint": {
                                            return a[prop.alias] - b[prop.alias];
                                        }
                                        case "number": {
                                            return a[prop.alias] - b[prop.alias];
                                        }
                                        default: {
                                            throw MyORMAdapterError("Unexpected data type.");
                                        }
                                    }
                            });
                        }
                    }

                    // apply offset and limit
                    if(offset) {
                        if(limit) {
                            results = results.slice(offset, offset+limit);
                        } else {
                            results = results.slice(offset);
                        }
                    } else {
                        if(limit) {
                            results = results.slice(0, limit);
                        }
                    }
                    
                    // apply select (map)
                    results = results.map(r => {
                        let o = {};
                        for(const column of select) {
                            if("aggregate" in column) continue;
                            o[column.alias] = r[column.alias];
                        }
                        return o;
                    });

                    return {
                        cmd: `No command available.`,
                        args: results
                    }
                },
                forCount(data) {
                    const { cmd, args } = this.forQuery(data);
                    return { 
                        cmd: `No command available.`,
                        args: [args.length] 
                    };
                },
                forInsert(data) {
                    const { columns, table, values } = data;
                    const startLen = config.$data[table].length + 1;
                    const newTable = config.$data[table].concat(values.map((v,n) => ({
                        // start with all columns from schema, so any columns that did not exist in `columns` (from the records inserted) will exist then, defaulted with null or insert id.
                        ...Object.fromEntries(Object.values(config.$schema[table]).map(c => [c.field, c.isIdentity ? startLen+n : null])),
                        // remaining columns that did exist in `columns` (from the records) inserted.
                        ...Object.fromEntries(columns.map((c,m) => {
                            if(config.$schema[table][c].isIdentity) {
                                return [c, startLen+n];
                            }
                            return [c, v[m]];
                        }))
                    })));
                    const uniques = new Set();
                    const uniqueKeys = Object.keys(config.$schema[table]).filter(k => config.$schema[table][k].isPrimary || config.$schema[table][k].isUnique);
                    config.$data[table].forEach(r => {
                        
                    });
                    for(const r of newTable) {
                        const fullKey = uniqueKeys.map(k => r[k]).join('_');
                        if(uniques.has(fullKey)) {
                            throw ErrorTypes.NON_UNIQUE_KEY();
                        }
                        uniques.add(fullKey);
                    }
                    
                    config.$data[table] = newTable;
                    return {
                        cmd: `No command available.`,
                        args: [values.length, startLen]
                    };
                },
                forUpdate(data) {
                    let numAffected = 0;
                    const { table, columns, where, explicit, implicit } = data;
                    if(implicit) { 
                        const { primaryKeys, objects } = implicit;
                        config.$data[table] = config.$data[table].map(o => {
                            if(filterFn(o, where)) {
                                // loop through all objects to be updated.
                                objectsToUpdateLoop: 
                                for(const record of objects) {
                                    let same = true;
                                    for(const pKey of primaryKeys) {
                                        same = record[pKey] === o[pKey];
                                        if(!same) break objectsToUpdateLoop;
                                    }
                                    numAffected++;
                                    return record;
                                }
                            }
                            return o;
                        });
                    }
                    if(explicit) {
                        const { values } = explicit;
                        config.$data[table].forEach(r => {
                            if(filterFn(r, where)) {
                                for(let i = 0; i < columns.length; ++i) {
                                    const col = columns[i];
                                    const val = values[i];
                                    r[col] = val;
                                }
                                numAffected++;
                            }
                        });
                    }
                    return {
                        cmd: `No command available.`,
                        args: [numAffected]
                    };
                },
                forDelete(data) {
                    const { table, where } = data;
                    const startLen = config.$data[table].length;
                    config.$data[table] = config.$data[table].filter(r => !filterFn(r, where));
                    return {
                        cmd: `No command available.`,
                        args: [startLen - config.$data[table].length]
                    };
                },
                forTruncate({ table }) {
                    const len = config.$data[table].length;
                    config.$data[table] = [];
                    return { 
                        cmd: `No command available.`,
                        args: [len]
                    };
                },
                forDescribe(table) {
                    return { 
                        cmd: `No command available.`,
                        args: /** @type {any[]} */ (/** @type {unknown} */ (config.$schema[table]))
                    };
                },
                forConstraints(table) {
                    return {
                        cmd: `No command available.`,
                        args: []
                    };
                }
            }
        }
    }
}