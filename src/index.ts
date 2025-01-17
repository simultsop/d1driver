/**
 * Simple D1 driver for Cloudflare sqlite database interaction.
 * @module
 */

enum SQLiteSyntax {
    SELECT = "SELECT",
    IS_NULL = "IS NULL",
    IS_NOT_NULL = "IS NOT NULL",
    ALL = "*",
    FROM = "FROM",
    WHERE = "WHERE",
    AND = "AND",
    OR = "OR",
    INSERT_INTO = "INSERT INTO",
    DELETE = "DELETE",
    VALUES = "VALUES",
    UPDATE = "UPDATE",
    SET = "SET",
    RETURNING = "RETURNING",
    CURRENT_TIMESTAMP = "CURRENT_TIMESTAMP"
}

/**
 * Get all records of a table.
 *
 * @param {D1Database} DB Cloudflare D1Database.
 * @param {string} table Table name.
 * @param {object|undefined} conditions Object of conditions, e.g.: {status: 1, username: "john"}.
 * @param {string|undefined} fields Coma separated field names of the table defaults to *.
 */
export const get = async(DB: D1Database, table: string, conditions?: object, fields?: string) => {
    const nullConditions: string[] = []
    const conditionsPlacement: string[] = []
    const bindingConditions: string[] = []

    if(conditions) {
        let conditionsCounter = 1;
        for (const [key, value] of Object.entries(conditions)) {
            if(value === null) {
                nullConditions.push(` ${key} ${SQLiteSyntax.IS_NULL} `)
                continue;
            }
            conditionsPlacement.push(` ${key} = ?${conditionsCounter} `)
            bindingConditions.push(value)
            conditionsCounter++;
        }
    }

    return DB
        .prepare(
            `${SQLiteSyntax.SELECT} ${fields ?? SQLiteSyntax.ALL} `+
            `${SQLiteSyntax.FROM} ${table} `+
            `${ conditions ? SQLiteSyntax.WHERE + conditionsPlacement.join(` ${SQLiteSyntax.AND} `) : '' } `+
            `${ nullConditions.length===1 ? SQLiteSyntax.AND + nullConditions[0] : '' } `+
            `${ nullConditions.length>1 ? SQLiteSyntax.AND + nullConditions.join(` ${SQLiteSyntax.AND} `) : '' } `
        )
        .bind(...bindingConditions)
        .all();
}

/**
 * Create a record in a table.
 *
 * @param {D1Database} DB Cloudflare D1Database.
 * @param {string} table Table name.
 * @param {object|undefined} entity Object model to be inserted e.g.: { name: "john", surname: "doe", age: 44 }
 */
export const create = async(DB: D1Database, table: string, entity: object) => {
    const fieldsPlacement: string[] = []
    const bindingValues: string[] = []
    let bindingPlacement: string = ''

    let fieldsCounter = 1;
    for (const [key, value] of Object.entries(entity)) {
        fieldsPlacement.push(key)
        bindingValues.push(value)
        bindingPlacement += `?${fieldsCounter}, `
        fieldsCounter++;
    }

    return DB
        .prepare(
            `${SQLiteSyntax.INSERT_INTO} ${table} `+ 
            `${ fieldsPlacement.length>0 ? '('+fieldsPlacement.join(',')+')' : '' } `+
            `${SQLiteSyntax.VALUES} (${bindingPlacement.slice(0, -2)}) `+
            `${SQLiteSyntax.RETURNING} ${SQLiteSyntax.ALL} `
        )
        .bind(...bindingValues)
        .run();
}

/**
 * Update a record in a table.
 *
 * @param {D1Database} DB Cloudflare D1Database.
 * @param {string} table Table name.
 * @param {object|undefined} entity Object model to be inserted e.g.: { age: 45 }
 */
export const update = async(DB: D1Database, table: string, entity: object, conditions?: object) => {
    const timestampUpdates: string[] = []
    const fieldsPlacement: string[] = []
    const bindingValues: string[] = []

    let fieldsCounter = 1;
    for (const [key, value] of Object.entries(entity)) {
        if(value === SQLiteSyntax.CURRENT_TIMESTAMP) {
            timestampUpdates.push(` ${key} = ${SQLiteSyntax.CURRENT_TIMESTAMP} `)
            continue;
        }

        fieldsPlacement.push(` ${key} = ?${fieldsCounter} `)
        bindingValues.push(value)
        fieldsCounter++;
    }

    const conditionsPlacement: string[] = []
    const bindingConditions: string[] = []

    if(conditions) {
        let conditionsCounter = fieldsCounter;
        for (const [key, value] of Object.entries(conditions)) {
            conditionsPlacement.push(` ${key} = ?${conditionsCounter} `)
            bindingConditions.push(value)
            conditionsCounter++;
        }
    }

    const allBindings = bindingValues.concat(bindingConditions)

    return DB
        .prepare(
            `${SQLiteSyntax.UPDATE} ${table} ${SQLiteSyntax.SET} `+ 
            `${ timestampUpdates.length===1 ? timestampUpdates[0] + ', ' : '' } `+
            `${ timestampUpdates.length>1 ? timestampUpdates.join(', ').slice(0, -2) : '' } `+
            `${ fieldsPlacement.length>0 ? fieldsPlacement.join(', ').slice(0, -2) : '' } `+
            `${ conditions ? SQLiteSyntax.WHERE + conditionsPlacement.join(' ' + SQLiteSyntax.AND + ' ') : '' } `
        )
        .bind(...allBindings)
        .run();
}

/**
 * Delete a record in a table.
 *
 * @param {D1Database} DB Cloudflare D1Database.
 * @param {string} table Table name.
 * @param {object|undefined} conditions Object of conditions, e.g.: {status: 1, username: "john"}.
 */
export const remove = async(DB: D1Database, table: string, conditions?: object, softRemove?: boolean) => {
    const conditionsPlacement: string[] = []
    const bindingConditions: string[] = []

    if(conditions) {
        let conditionsCounter = 1;
        for (const [key, value] of Object.entries(conditions)) {
            conditionsPlacement.push(` ${key} = ?${conditionsCounter} `)
            bindingConditions.push(value)
            conditionsCounter++;
        }
    }

    if(softRemove===true) {
        const { results: existingEntity } = await get(DB, table, conditions);
        if(existingEntity.length === 1 && existingEntity[0].deletedAt === null) {
            return update(DB, table, { deletedAt: SQLiteSyntax.CURRENT_TIMESTAMP }, conditions);
        }
    }

    return DB
        .prepare(
            `${SQLiteSyntax.DELETE} ${SQLiteSyntax.FROM} ${table} `+ 
            `${ conditions ? SQLiteSyntax.WHERE + conditionsPlacement.join(' ' + SQLiteSyntax.AND + ' ') : '' } `
        )
        .bind(...bindingConditions)
        .run();
}
