const fs = require('fs');
const path = require('path');

let output = '# SEQUELIZE MODELS\n';
const log = (msg) => { output += msg + '\n'; };

try {
    const models = require('./src/models');
    for (const modelName of Object.keys(models)) {
        if (modelName === 'sequelize' || modelName === 'Sequelize') continue;
        const model = models[modelName];
        log('\n## Model: ' + modelName);
        log('- tableName: ' + model.tableName);
        log('- primaryKeyAttributes: ' + (model.primaryKeyAttributes || []).join(', '));
        
        if (model.associations) {
            log('  Associations:');
            for (const assocName of Object.keys(model.associations)) {
                const assoc = model.associations[assocName];
                log(`    - ${assoc.associationType} ${assocName} -> ${assoc.target.name} (FK: ${assoc.foreignKey})`);
            }
        }
    }
} catch (err) {
    log('ERROR: ' + err.stack);
}

fs.writeFileSync('audit_models.txt', output);
console.log('Model audit complete.');
