import { fileURLToPath } from 'node:url';
import path, { dirname, join } from 'node:path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export default {
    entry:"./app/src/main.ts",
    output:{
        filename: "bundle.js",
        path: path.resolve(path.join(__dirname, "app/dist"))
    },
    mode: "development"
}   