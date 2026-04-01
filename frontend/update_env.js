const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (file.endsWith('.jsx')) {
        const fullPath = path.join(dir, file);
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/const API_BASE = 'http:\/\/localhost:5001\/api';/g, "const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';");
        fs.writeFileSync(fullPath, content);
    }
});
console.log("All React views successfully injected with production environment variables!");
