// Windows 7 build: put the official better-sqlite3 prebuild for Electron 22 into win7/node_modules, for the
// machine's own platform (Linux for tests, Windows on the build server). Never compiles anything.
// The Windows x64 / ia32 modules inside the installer are set by after-pack.cjs.
const { execFileSync } = require('child_process')
const path = require('path')

const win7 = path.resolve(__dirname, '../win7')
const electron = require(path.join(win7, 'node_modules/electron/package.json')).version
const pkgDir = path.join(win7, 'node_modules/better-sqlite3')
const prebuild = require.resolve('prebuild-install/bin.js', { paths: [pkgDir, win7] })
console.log(`better-sqlite3: downloading the prebuild for Electron ${electron} (${process.platform}-${process.arch})`)
execFileSync(process.execPath, [prebuild, '--runtime', 'electron', '--target', electron, '--arch', process.arch], { cwd: pkgDir, stdio: 'inherit' })
