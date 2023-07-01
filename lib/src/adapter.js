// @ts-check
import { MyORMContext } from "@myorm/myorm";
import { createPool } from "mysql2/promise";

// the JSON adapter is much different from other adapters, as a command and respective arguments aren't used, everything is done within this program rather than
// being expected to be sent to a database server. Therefore, many of the types will be casted and what is returned from each of the serialization functions
// will not reflect what would actually be sent.

/**
 * @typedef {object} JsonDatabase
 * @prop {Record<string, Record<string, import("@myorm/myorm").DescribedSchema>>} $schema
 * @prop {Record<string, import("@myorm/myorm").SqlTable[]>} $database
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
        serialize(scope) {
            return {
                forQuery(data) {
                    let { where, group_by, order_by, limit, offset, select, from } = data;
                    let [mainTable, ...remainingTables] = from;
                    
                    // apply from (look for like primary keys then map property names to the aliased versions.)

                    // apply where
                    /** @type {any[]} */
                    let results = config.$database[mainTable.table].filter(v => filterFn(v, where));

                    // apply group by
                    if(group_by) {
                        // (group first)
                        results = results.map(r => {
                            if(!group_by) return r;
                            let o = {};
                            for(const column of group_by) {
                                o[column.column] = r[column.column];
                            }
                            return o;
                        });

                        results = results.filter((r,n,self) => {
                            const idx = self.findIndex(m => {
                                if(!group_by) return false;
                                for(const column of group_by) {
                                    if(r[column.column] !== m[column.column]) return false;
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
                                switch(typeof a[prop.column]) {
                                        case "string": {
                                            return a[prop.column].localeCompare(b[prop.column]);
                                        }
                                        case "boolean": {
                                            return a[prop.column] - b[prop.column];
                                        }
                                        case "object": {
                                            if(a[prop.column] instanceof Date) {
                                                return a[prop.column].getTime() - b[prop.column].getTime();
                                            } else {
                                                throw scope.MyORMAdapterError("Unexpected data type.");
                                            }
                                        }
                                        case "bigint": {
                                            return a[prop.column] - b[prop.column];
                                        }
                                        case "number": {
                                            return a[prop.column] - b[prop.column];
                                        }
                                        default: {
                                            throw scope.MyORMAdapterError("Unexpected data type.");
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
                            o[column.column] = r[column.column];
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
                    const startLen = config.$database[table].length + 1;
                    config.$database[table] = config.$database[table].concat(values.map((v,n) => ({
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
                        config.$database[table] = config.$database[table].map(o => {
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
                        config.$database[table].forEach(r => {
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
                    const startLen = config.$database[table].length;
                    config.$database[table] = config.$database[table].filter(r => !filterFn(r, where));
                    return {
                        cmd: `No command available.`,
                        args: [startLen - config.$database[table].length]
                    };
                },
                forTruncate({ table }) {
                    const len = config.$database[table].length;
                    config.$database[table] = [];
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

export const createMySql2Pool = createPool;

/** @type {JsonDatabase} */
const database = {
    $schema: {
        Car: {
            Id: {
                table: "Car",
                field: "Id",
                alias: "",
                isPrimary: true,
                isIdentity: true,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Make: {
                table: "Car",
                field: "Make",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Model: {
                table: "Car",
                field: "Model",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Color: {
                table: "Car",
                field: "Color",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Year: {
                table: "Car",
                field: "Year",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Mileage: {
                table: "Car",
                field: "Mileage",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            MPGHwy: {
                table: "Car",
                field: "MPGHwy",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            MPGCity: {
                table: "Car",
                field: "MPGCity",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
        }
    },
    $database: {
        Car: [
            { Id: 1, Make: "Ford", Model: "Focus", Color: "Yellow", Year: 2020, Mileage: 32145, MPGHwy: 37.6, MPGCity: 26.2 },
            { Id: 2, Make: "Toyota", Model: "Tundra", Color: "Red", Year: 2014, Mileage: 121419, MPGHwy: 32.9, MPGCity: 21.7 },
            { Id: 3, Make: "Ford", Model: "Fusion", Color: "Red", Year: 2019, Mileage: 69225, MPGHwy: 34.3, MPGCity: 26.9 },
            { Id: 4, Make: "Chevy", Model: "Equinox", Color: "Red", Year: 2022, Mileage: 17143, MPGHwy: 35.1, MPGCity: 22.4 },
            { Id: 5, Make: "Ford", Model: "Escape", Color: "Blue", Year: 2022, Mileage: 13417, MPGHwy: 34.9, MPGCity: 20.6 },
            { Id: 6, Make: "Toyota", Model: "Tacoma", Color: "Blue", Year: 2023, Mileage: 499, MPGHwy: 29.7, MPGCity: 16.4 },
            { Id: 7, Make: "Ford", Model: "F150", Color: "Blue", Year: 2020, Mileage: 51222, MPGHwy: 28.6, MPGCity: 17.0 },
            { Id: 8, Make: "Chevy", Model: "Malibu", Color: "White", Year: 2018, Mileage: 67446, MPGHwy: 37.2, MPGCity: 23.7 },
            { Id: 9, Make: "Toyota", Model: "Tacoma", Color: "White", Year: 2023, Mileage: 2747, MPGHwy: 30.1, MPGCity: 16.8 },
            { Id: 10, Make: "Dodge", Model: "Charger", Color: "White", Year: 2022, Mileage: 7698, MPGHwy: 29.9, MPGCity: 14.1 },
            { Id: 11, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2021, Mileage: 21567, MPGHwy: 28.2, MPGCity: 13.8 },
            { Id: 12, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2013, Mileage: 123411, MPGHwy: 28.1, MPGCity: 14.1 },
            { Id: 13, Make: "Dodge", Model: "Hornet", Color: "Black", Year: 2013, Mileage: 108753, MPGHwy: 31.5, MPGCity: 16.9 },
            { Id: 14, Make: "Chevy", Model: "Malibu", Color: "Silver", Year: 2021, Mileage: 14353, MPGHwy: 34.9, MPGCity: 20.0 },
            { Id: 15, Make: "Dodge", Model: "Charger", Color: "Silver", Year: 2020, Mileage: 92442, MPGHwy: 26.6, MPGCity: 13.1 },
        ]
    }
};

/** @type {MyORMContext<{ Id?: number, Make: string, Model: string, Color: string, Year: number, MPGCity: number, MPGHwy: number, Mileage: number }>} */
const ctx = new MyORMContext(adapter(database), "Car", { allowTruncation: true });

ctx.sortBy(m => m.Make).groupBy((m) => [m.Make, m.Color]).select().then(r => {
    console.log(r);
})