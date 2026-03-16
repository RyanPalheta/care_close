const fs = require('fs');
const path = require('path');

function resolveConflictsInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const conflictRegex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [a-f0-9]+\r?\n?/g;
    
    let modified = false;
    content = content.replace(conflictRegex, (match, headContent, incomingContent) => {
        modified = true;
        return headContent; // Keep HEAD version
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Resolved conflicts in ${filePath}`);
    }
}

// target specific files that often have conflicts
resolveConflictsInFile('package-lock.json');
resolveConflictsInFile('package.json');
resolveConflictsInFile('public/manifest.json');

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fullPath.includes('node_modules') || fullPath.includes('.next') || fullPath.includes('.git')) continue;
        
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.json') || fullPath.endsWith('.css')) {
            resolveConflictsInFile(fullPath);
        }
    }
}

traverseDir(path.join(__dirname, 'src'));
console.log('Finished resolving conflicts.');
