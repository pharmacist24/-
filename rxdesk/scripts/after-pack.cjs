// electron-builder afterPack hook.
// When the installer is built on Linux/macOS, the native SQLite module in node_modules was compiled
// for that machine. Replace it with the official Windows prebuilt binary for our Electron version,
// and refuse to produce an installer that contains a non-Windows binary.
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

function isWindowsDll(file) {
  const fd = fs.openSync(file, 'r')
  const buf = Buffer.alloc(2)
  fs.readSync(fd, buf, 0, 2, 0)
  fs.closeSync(fd)
  return buf.toString('latin1') === 'MZ'
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const target = path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  if (!fs.existsSync(target)) throw new Error('better_sqlite3.node missing from package: ' + target)
  if (isWindowsDll(target)) return

  const projectDir = context.packager.projectDir
  const electronVersion = context.packager.config.electronVersion || require(path.join(projectDir, 'node_modules/electron/package.json')).version
  // electron-builder Arch enum: 0 ia32, 1 x64, 2 armv7l, 3 arm64 (the Windows 7 installer contains ia32 + x64).
  const arch = ['ia32', 'x64', 'armv7l', 'arm64'][context.arch] || 'x64'
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-sqlite-win-'))
  fs.copyFileSync(path.join(projectDir, 'node_modules/better-sqlite3/package.json'), path.join(work, 'package.json'))
  console.log(`  • fetching Windows ${arch} better-sqlite3 for Electron ${electronVersion}`)
  execFileSync(
    process.execPath,
    [require.resolve('prebuild-install/bin.js', { paths: [projectDir] }), '--runtime', 'electron', '--target', electronVersion, '--platform', 'win32', '--arch', arch, '--verbose'],
    { cwd: work, stdio: 'inherit' }
  )
  const downloaded = path.join(work, 'build', 'Release', 'better_sqlite3.node')
  if (!fs.existsSync(downloaded) || !isWindowsDll(downloaded)) throw new Error('Could not get the Windows build of better-sqlite3')
  fs.copyFileSync(downloaded, target)
  fs.rmSync(work, { recursive: true, force: true })
  console.log(`  • replaced better_sqlite3.node with the Windows ${arch} build`)
}
