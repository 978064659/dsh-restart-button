/**
 * DeepSeek Harness (dsh) plugin: dsh-restart-button - Host half.
 *
 * The desktop shell (Electron) is the only process that can relaunch itself:
 * it calls `app.relaunch()` from its own main process, and the Harness Host is
 * that process's child. A Host plugin therefore cannot ask the shell to
 * restart through any supported API, so this plugin takes a route that stays
 * outside the shell's own process tree:
 *
 *   1. The browser half POSTs `/plugins/restart-button` (same-origin; the web
 *      server's own session cookie authorizes it).
 *   2. This half writes two PowerShell scripts and starts the first one as a
 *      hidden child process. The first script arms the second one through WMI
 *      (`Win32_Process.Create`), which is owned by WmiPrvSE, not by this Host,
 *      so it survives whatever happens to the process tree next.
 *   3. The armed second script waits for the old shell to disappear, then
 *      starts the installed executable again from its own directory.
 *   4. The first script force-stops the shell process and this Host.
 *
 * A hard stop is deliberate: the shell turns a window close into "hide to
 * tray", and the Host may only shut down through its parent's IPC channel, so
 * a graceful external quit is not reachable from a plugin. Running tasks are
 * interrupted by design; the client half asks before sending the request.
 *
 * Loaded via cordis.patch.yml (`insert: [{ id: restart-button, name:
 * 'dsh-restart-button' }]`); see package.json `dsh.bundle` and `dsh.client`.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const name = 'restart-button'

export const inject = ['webServer', 'connection']

/** One authenticated endpoint; the client half uses GET to probe, POST to act. */
const ROUTE = '/plugins/restart-button'

/**
 * Stage 1: arm stage 2 outside this process tree, then stop the old shell.
 *
 * `-WindowStyle Hidden` keeps the console invisible. This script is started as
 * an ordinary child (not detached: a detached console process does not start
 * reliably on every Windows build), so it may die together with the Host it
 * stops - by then stage 2 is already independent and will do the relaunch.
 */
const STAGE_ONE = String.raw`param(
  [Parameter(Mandatory = $true)][int]$HostPid,
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$StageTwo,
  [Parameter(Mandatory = $true)][string]$Log
)
$ErrorActionPreference = 'SilentlyContinue'
$appName = [System.IO.Path]::GetFileName($Exe)
function Write-Log([string]$message) {
  Add-Content -LiteralPath $Log -Value ('{0:HH:mm:ss.fff} stage1 {1}' -f (Get-Date), $message)
}

Write-Log ('host=' + $HostPid + ' exe=' + $Exe)

# Stage 2 must not be a descendant of the Host we are about to stop.
$quotedStageTwo = '"' + $StageTwo + '"'
$quotedExe = '"' + $Exe + '"'
$quotedLog = '"' + $Log + '"'
$commandLine = 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File ' + $quotedStageTwo + ' ' + $HostPid + ' ' + $quotedExe + ' ' + $quotedLog
$armed = $false
try {
  $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $commandLine
    CurrentDirectory = [System.IO.Path]::GetDirectoryName($Exe)
  }
  Write-Log ('stage2 return=' + $created.ReturnValue + ' pid=' + $created.ProcessId)
  $armed = [int]$created.ReturnValue -eq 0
} catch {
  Write-Log ('stage2 wmi threw: ' + $_.Exception.Message)
}
if (-not $armed) {
  try {
    $fallback = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
      '-File', $StageTwo, [string]$HostPid, $Exe, $Log
    ) -WindowStyle Hidden -PassThru
    Write-Log ('stage2 fallback pid=' + $fallback.Id)
    $armed = $true
  } catch {
    Write-Log ('stage2 fallback threw: ' + $_.Exception.Message)
  }
}
if (-not $armed) { exit 1 }

# Give the armed script a moment to start before the tree goes away.
Start-Sleep -Milliseconds 500

$targets = @(Get-CimInstance Win32_Process -Filter "Name='$appName'" | Where-Object {
  $_.ExecutablePath -eq $Exe -and
  $_.CommandLine -notmatch '--type=' -and
  $_.CommandLine -notmatch 'dsh-desktop-host'
})
foreach ($target in $targets) {
  Write-Log ('stop shell pid=' + $target.ProcessId)
  Stop-Process -Id $target.ProcessId -Force
}
Start-Sleep -Milliseconds 300
Write-Log ('stop host pid=' + $HostPid)
Stop-Process -Id $HostPid -Force
Write-Log 'stage1 done'
`

/**
 * Stage 2: wait for the old shell to be gone, then start the shell again.
 *
 * Started through WMI, so its parent is the WMI provider service and stopping
 * the Host cannot take it down.
 */
const STAGE_TWO = String.raw`param(
  [Parameter(Mandatory = $true)][int]$HostPid,
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$Log
)
$ErrorActionPreference = 'SilentlyContinue'
$appName = [System.IO.Path]::GetFileName($Exe)
function Write-Log([string]$message) {
  Add-Content -LiteralPath $Log -Value ('{0:HH:mm:ss.fff} stage2 {1}' -f (Get-Date), $message)
}
function Get-ShellProcesses {
  return @(Get-CimInstance Win32_Process -Filter "Name='$appName'" | Where-Object {
    $_.ExecutablePath -eq $Exe -and
    $_.CommandLine -notmatch '--type=' -and
    $_.CommandLine -notmatch 'dsh-desktop-host'
  })
}
function Start-ShellProcess {
  $folder = [System.IO.Path]::GetDirectoryName($Exe)
  # WMI creates the shell under WmiPrvSE: no console and no parent inside this
  # process tree, so closing this script or its window cannot take it down.
  try {
    $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
      CommandLine = ('"' + $Exe + '"')
      CurrentDirectory = $folder
    }
    Write-Log ('launch wmi rc=' + $created.ReturnValue + ' pid=' + $created.ProcessId)
    if ([int]$created.ReturnValue -eq 0) { return $true }
  } catch {
    Write-Log ('launch wmi threw: ' + $_.Exception.Message)
  }
  try {
    Start-Process -FilePath $Exe -WorkingDirectory $folder
    Write-Log 'launch fallback Start-Process'
    return $true
  } catch {
    Write-Log ('launch fallback threw: ' + $_.Exception.Message)
    return $false
  }
}

Write-Log ('start host=' + $HostPid)

$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline -and @(Get-ShellProcesses).Count -gt 0) {
  Start-Sleep -Milliseconds 300
}
$remaining = @(Get-ShellProcesses).Count
Write-Log ('old shell processes=' + $remaining)
if ($remaining -gt 0) {
  # The stop never happened; starting a second instance would only be bounced
  # by the single-instance lock, so leave the running app alone.
  Write-Log 'abort: old shell still running'
  exit 2
}

Start-Sleep -Milliseconds 800
for ($attempt = 1; $attempt -le 5; $attempt++) {
  $started = Start-ShellProcess
  Start-Sleep -Seconds 2
  $running = @(Get-ShellProcesses).Count
  Write-Log ('launch attempt ' + $attempt + ' started=' + $started + ' shell processes=' + $running)
  if ($running -gt 0) { break }
}
Write-Log 'stage2 done'
`

/** Whether this process can hand its parent shell a relaunch request. */
function capability() {
  const exePath = process.execPath
  const windows = process.platform === 'win32'
  // Electron's Node mode reports its Electron version; a plain `dsh web` under
  // Node does not, and a browser-opened Harness has no shell to relaunch.
  const desktop = windows && typeof process.versions.electron === 'string' && /\.exe$/iu.test(exePath)
  const parent = typeof process.ppid === 'number' && process.ppid > 1
  const supported = desktop && parent
  return {
    supported,
    platform: process.platform,
    app: exePath.split(/[\\/]/u).pop() ?? exePath,
    ...supported ? {} : { reason: 'Only the Windows desktop app can be relaunched from here.' },
  }
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Write both helpers and start stage 1.
 * @returns whether stage 1 was spawned; the request itself is answered first.
 */
function startRelaunch(ctx) {
  const exePath = process.execPath
  const hostPid = process.pid
  try {
    const folder = join(tmpdir(), 'dsh-restart-button')
    mkdirSync(folder, { recursive: true })
    const stamp = `${hostPid}-${Date.now()}`
    const stageTwo = join(folder, `relaunch-${stamp}.ps1`)
    const stageOne = join(folder, `restart-${stamp}.ps1`)
    const log = join(folder, 'restart.log')
    writeFileSync(stageTwo, STAGE_TWO, 'utf8')
    writeFileSync(stageOne, STAGE_ONE, 'utf8')

    const powershell = process.env.SystemRoot === undefined
      ? 'powershell.exe'
      : join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const child = spawn(powershell, [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      stageOne,
      String(hostPid),
      exePath,
      stageTwo,
      log,
    ], {
      stdio: 'ignore',
      windowsHide: true,
      cwd: folder,
    })
    child.on('error', (error) => {
      ctx.logger?.warn?.('restart-button: relaunch helper failed to start: %s', String(error))
    })
    child.unref()
    return true
  } catch (error) {
    ctx.logger?.warn?.('restart-button: relaunch helper could not be prepared: %s', String(error))
    return false
  }
}

export function apply(ctx) {
  let restarting = false

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    handler: (req, res) => {
      // The harness web server authenticates per route; this writes the 401
      // itself and owns the response when it returns false.
      if (!ctx.connection.authorizeIndex(req, res)) return

      const method = req.method ?? 'GET'
      if (method === 'GET' || method === 'HEAD') {
        writeJson(res, 200, capability())
        return
      }
      if (method !== 'POST') {
        res.writeHead(405, { allow: 'GET, HEAD, POST', 'cache-control': 'no-store' })
        res.end()
        return
      }

      const info = capability()
      if (!info.supported) {
        writeJson(res, 409, { ok: false, error: info.reason ?? 'Restart is unavailable', ...info })
        return
      }
      if (restarting) {
        writeJson(res, 429, { ok: false, error: 'Restart already in progress' })
        return
      }
      restarting = true
      if (!startRelaunch(ctx)) {
        restarting = false
        writeJson(res, 500, { ok: false, error: 'Could not start the relaunch helper' })
        return
      }
      writeJson(res, 202, { ok: true })
      ctx.logger?.info?.('restart-button: relaunch requested from the title bar')
    },
  }), 'restart-button: restart route')
}
