const fs = require('fs');
const path = require('path');

const searchPatterns = [
    { name: 'Silenced Catch', regex: /\.catch\s*\(\s*\([^)]*\)\s*=>\s*{\s*console\.(warn|error|log)[^}]*}\s*\)/g },
    { name: 'Empty Catch Block', regex: /catch\s*\([^)]*\)\s*{\s*}/g },
    { name: 'Catch Return Empty', regex: /catch\s*\([^)]*\)\s*{\s*return;?\s*}/g },
    { name: 'AllSettled', regex: /Promise\.allSettled/g }
];

const walkSync = (dir, filelist = []) => {
    if (!fs.existsSync(dir)) return filelist;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else if (filepath.endsWith('.js')) {
            filelist.push(filepath);
        }
    }
    return filelist;
};

const findPatterns = () => {
    const files = walkSync(path.join(__dirname, 'server/src'));
    const results = {};

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        searchPatterns.forEach(pattern => {
            const matches = content.match(pattern.regex);
            if (matches) {
                if (!results[pattern.name]) results[pattern.name] = [];
                results[pattern.name].push(`${file.replace(path.join(__dirname, 'server/src/'), '')}: ${matches.length} occurrences`);
            }
        });
    });

    console.log(JSON.stringify(results, null, 2));
};

findPatterns();
