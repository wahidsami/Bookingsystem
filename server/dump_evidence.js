const { Sequelize } = require('sequelize');
const fs = require('fs');

async function extractEvidence() {
    // We connect to rifah_clean directly to prove it's the live database we are inspecting.
    const sequelize = new Sequelize('rifah_clean', 'postgres', 'dev_password', {
        host: '127.0.0.1',
        port: 5432,
        dialect: 'postgres',
        logging: false
    });

    let output = '# Live Database Evidence (`rifah_clean`)\n\n';

    try {
        await sequelize.authenticate();
        
        let [dbRes] = await sequelize.query("SELECT current_database();");
        output += `## Current Database\n\`\`\`\n${dbRes[0].current_database}\n\`\`\`\n\n`;

        let [schemaRes] = await sequelize.query("SELECT current_schema();");
        output += `## Current Schema\n\`\`\`\n${schemaRes[0].current_schema}\n\`\`\`\n\n`;

        let [pathRes] = await sequelize.query("SHOW search_path;");
        output += `## Search Path\n\`\`\`\n${pathRes[0].search_path}\n\`\`\`\n\n`;

        let [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
        
        output += `## Tables in Public Schema (${tables.length})\n`;
        for (let t of tables) {
            output += `- ${t.table_name}\n`;
        }
        output += '\n## Detailed Table Schemas\n\n';

        for (let t of tables) {
            output += `### Table: ${t.table_name}\n`;
            
            // Columns
            output += `**Columns:**\n`;
            const [columns] = await sequelize.query(`
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = '${t.table_name}'
                ORDER BY ordinal_position;
            `);
            for (const col of columns) {
                output += `- \`${col.column_name}\`: ${col.data_type} (Nullable: ${col.is_nullable}, Default: ${col.column_default})\n`;
            }
            
            // Foreign keys
            const [fks] = await sequelize.query(`
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM
                    information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='${t.table_name}';
            `);
            if (fks.length > 0) {
                output += `\n**Foreign Keys:**\n`;
                for (const fk of fks) {
                    output += `- \`${fk.constraint_name}\`: \`${fk.column_name}\` -> \`${fk.foreign_table_name}.${fk.foreign_column_name}\`\n`;
                }
            }

            // Indexes
            const [indexes] = await sequelize.query(`
                SELECT
                    indexname,
                    indexdef
                FROM
                    pg_indexes
                WHERE
                    tablename = '${t.table_name}';
            `);
            if (indexes.length > 0) {
                output += `\n**Indexes:**\n`;
                for (const idx of indexes) {
                    output += `- \`${idx.indexname}\`: ${idx.indexdef}\n`;
                }
            }
            output += `\n---\n\n`;
        }
        
    } catch (err) {
        output += `\nERROR: ${err.message}\n`;
    } finally {
        await sequelize.close();
    }

    fs.writeFileSync('C:\\Users\\wahid\\.gemini\\antigravity-ide\\brain\\58ecc283-eb7a-4850-b579-bb000f11c93d\\rifah_clean_evidence.md', output);
    console.log("Evidence dumped successfully.");
}

extractEvidence();
