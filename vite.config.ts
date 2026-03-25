import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function versionPlugin(): Plugin {
  return {
    name: 'generate-version',
    closeBundle() {
      const changelog = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'src/changelog.json'), 'utf8')
      );
      const versionData = {
        version: changelog.version,
        notes: changelog.notes,
        ts: Date.now(),
      };
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/version.json'),
        JSON.stringify(versionData)
      );
      console.log('[version] dist/version.json written — v' + versionData.version + ' ts=' + versionData.ts);
    },
  };
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  plugins: [versionPlugin()],
});
