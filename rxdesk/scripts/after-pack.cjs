// electron-builder afterPack hook.
// When the installer is built on Linux/macOS, the native SQLite module in node_modules was compiled
// for that machine. Replace it with the official Windows prebuilt binary for our Electron version,
// and refuse to produce an installer that contains a non-Windows binary.
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PE_MACHINE = { ia32: 0x14c, x64: 0x8664, arm64: 0xaa64 }

/** True for a Windows DLL; with `arch`, also checks it is built for that CPU (32-bit vs 64-bit). */
function isWindowsDll(file, arch) {
  const buf = fs.readFileSync(file)
  if (buf.length < 64 || buf.toString('latin1', 0, 2) !== 'MZ') return false
  if (!arch || !PE_MACHINE[arch]) return true
  const pe = buf.readUInt32LE(0x3c)
  return buf.readUInt16LE(pe + 4) === PE_MACHINE[arch]
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const target = path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  // A non-Windows binary (built on Linux) or one for the other CPU (32/64-bit): fetch the official
  // Windows prebuild for this Electron version and architecture.
  // electron-builder Arch enum: 0 ia32, 1 x64, 2 armv7l, 3 arm64 (the Windows 7 installer contains ia32 + x64).
  const arch = ['ia32', 'x64', 'armv7l', 'arm64'][context.arch] || 'x64'
  if (!fs.existsSync(target)) throw new Error('better_sqlite3.node missing from package: ' + target)
  if (isWindowsDll(target, arch)) return

  const projectDir = context.packager.projectDir
  const electronVersion = context.packager.config.electronVersion || require(path.join(projectDir, 'node_modules/electron/package.json')).version
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-sqlite-win-'))
  fs.copyFileSync(path.join(projectDir, 'node_modules/better-sqlite3/package.json'), path.join(work, 'package.json'))
  console.log(`  • fetching Windows ${arch} better-sqlite3 for Electron ${electronVersion}`)
  execFileSync(
    process.execPath,
    [require.resolve('prebuild-install/bin.js', { paths: [projectDir] }), '--runtime', 'electron', '--target', electronVersion, '--platform', 'win32', '--arch', arch, '--verbose'],
    { cwd: work, stdio: 'inherit' }
  )
  const downloaded = path.join(work, 'build', 'Release', 'better_sqlite3.node')
  if (!fs.existsSync(downloaded) || !isWindowsDll(downloaded, arch)) throw new Error('Could not get the Windows build of better-sqlite3')
  fs.copyFileSync(downloaded, target)
  fs.rmSync(work, { recursive: true, force: true })
  console.log(`  • replaced better_sqlite3.node with the Windows ${arch} build`)
}
