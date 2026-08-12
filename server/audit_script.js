const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

async function audit() {
    const modelsDir = path.join(__dirname, 'src', 'models');
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // We cannot connect to DB, so we'll build a map of Model Attributes using a dummy postgres dialect
    const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', { logging: false });
    
    const db = {};
    const files = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js') && file !== 'index.js');
    
    for (const file of files) {
        try {
            const model = require(path.join(modelsDir, file))(sequelize, DataTypes);
            db[model.name] = model;
        } catch (e) {
            console.log("Error loading", file, e.message);
        }
    }

    const camelCaseRegex = /^[a-z]+[A-Z][a-zA-Z0-9]*$/;
    const modelColumns = new Set();
    const modelCamelColumns = new Map(); // column -> model
    
    for (const modelName of Object.keys(db)) {
        const model = db[modelName];
        if (model.rawAttributes) {
            for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
                const fieldName = attr.field || attrName;
                if (camelCaseRegex.test(fieldName)) {
                    modelCamelColumns.set(fieldName, modelName);
                }
            }
        }
    }
    
    console.log(`Found ${modelCamelColumns.size} camelCase columns in models.`);
    
    const sqlFiles = fs.readdirSync(path.join(__dirname, '..'))
        .filter(f => f.endsWith('.sql'))
        .map(f => path.join(__dirname, '..', f));
        
    const jsMigrations = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(migrationsDir, f));
        
    const allFiles = [...sqlFiles, ...jsMigrations];
    
    const mismatches = [];
    
    for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        for (const [column, modelName] of modelCamelColumns.entries()) {
            // Find column name NOT surrounded by quotes
            // We use a regular expression loop
            const regex = new RegExp(`(?<!["'_\w])${column}(?!["'_\w])`, 'g');
            let match;
            while ((match = regex.exec(content)) !== null) {
                const isSurroundedBySingleQuotes = 
                    content[match.index - 1] === "'" && content[match.index + column.length] === "'";
                
                const isSurroundedByDoubleQuotes = 
                    content[match.index - 1] === '"' && content[match.index + column.length] === '"';
                    
                if (!isSurroundedBySingleQuotes && !isSurroundedByDoubleQuotes) {
                    const start = Math.max(0, match.index - 30);
                    const end = Math.min(content.length, match.index + column.length + 30);
                    const context = content.substring(start, end).replace(/\n/g, ' ');
                    
                    mismatches.push({
                        column,
                        model: modelName,
                        file: path.basename(file),
                        context: context.trim()
                    });
                }
            }
        }
    }
    
    fs.writeFileSync('audit_mismatches.json', JSON.stringify(mismatches, null, 2));
    console.log(`Wrote ${mismatches.length} potential mismatches to audit_mismatches.json`);
}

audit();
