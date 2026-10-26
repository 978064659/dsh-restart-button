// Browser half of the dsh-restart-button plugin.
//
// Draws one caption-style button in the Windows desktop title bar, immediately
// left of the native minimize control, so a freshly installed plugin can be
// picked up without quitting DeepSeek Harness by hand. The button is placed
// from the Window Controls Overlay geometry: `getTitlebarAreaRect()` reports
// the draggable strip, and its right edge is exactly where the OS-painted
// minimize/maximize/close buttons begin.
//
// The button only appears in the Windows desktop window: `[data-windows-titlebar]`
// is the shell's own marker for that frame, and the browser-opened Web GUI has
// no shell to relaunch. Clicking asks for confirmation, then POSTs the
// authenticated `/plugins/restart-button` route; the Host half stops and starts
// the app again. If the page is still alive several seconds later, the request
// did not take effect and the button reports it instead of pretending.
//
// Hand-written in the lazy-CJS bundle protocol (`window.__ModuleLoader__.load`
// with a factory returning cordis-plugin exports), same as other local plugins.
window.__ModuleLoader__.load({
  id: 'dsh-restart-button',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    var React = null
    function react() {
      if (React === null) React = require('react')
      return React
    }

    var ENDPOINT = '/plugins/restart-button'
    var STYLE_ID = 'dsh-restart-button-style'
    var WATCHDOG_MS = 7000

    var CSS = [
      '.dsh-rb-anchor {',
      '  position: fixed;',
      '  top: 0;',
      '  z-index: 40;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 32px;',
      '  pointer-events: none;',
      '  -webkit-app-region: no-drag;',
      '}',
      '.dsh-rb-button {',
      '  box-sizing: border-box;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 28px;',
      '  height: 26px;',
      '  padding: 0;',
      '  border: 0;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '  cursor: pointer;',
      '  pointer-events: auto;',
      '  -webkit-app-region: no-drag;',
      '  transition: background-color 120ms ease, color 120ms ease;',
      '}',
      '.dsh-rb-button:hover {',
      '  background: color-mix(in srgb, var(--dsw-alias-label-primary, #888) 14%, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dsh-rb-button:active {',
      '  background: color-mix(in srgb, var(--dsw-alias-label-primary, #888) 22%, transparent);',
      '}',
      '.dsh-rb-button:focus-visible {',
      '  outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe);',
      '  outline-offset: 1px;',
      '}',
      '.dsh-rb-dot {',
      '  position: absolute;',
      '  top: 3px;',
      '  right: 3px;',
      '  width: 5px;',
      '  height: 5px;',
      '  border-radius: 50%;',
      '  background: var(--dsw-alias-state-error-primary, #ef4444);',
      '}',
      '.dsh-rb-pill {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  height: 24px;',
      '  padding: 0 8px;',
      '  border-radius: 6px;',
      '  white-space: nowrap;',
      '  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12));',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '  font-size: 12px;',
      '  line-height: 24px;',
      '  pointer-events: auto;',
      '}',
      '.dsh-rb-spinner {',
      '  width: 11px;',
      '  height: 11px;',
      '  border-radius: 50%;',
      '  border: 1.5px solid color-mix(in srgb, var(--dsw-alias-label-secondary, #888) 35%, transparent);',
      '  border-top-color: var(--dsw-alias-brand-primary, #4d6bfe);',
      '  animation: dsh-rb-spin 720ms linear infinite;',
      '}',
      '@keyframes dsh-rb-spin { to { transform: rotate(360deg); } }',
      '.dsh-rb-popover {',
      '  position: absolute;',
      '  top: calc(100% + 6px);',
      '  right: 0;',
      '  width: 268px;',
      '  padding: 12px;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.24));',
      '  border-radius: 10px;',
      '  background: var(--dsw-alias-bg-overlay, #1e1f24);',
      '  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  pointer-events: auto;',
      '  -webkit-app-region: no-drag;',
      '}',
      '.dsh-rb-title {',
      '  margin: 0 0 6px;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  line-height: 18px;',
      '}',
      '.dsh-rb-body {',
      '  margin: 0;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '  font-size: 12px;',
      '  line-height: 18px;',
      '}',
      '.dsh-rb-error {',
      '  margin: 8px 0 0;',
      '  color: var(--dsw-alias-state-error-primary, #ef4444);',
      '  font-size: 12px;',
      '  line-height: 17px;',
      '}',
      '.dsh-rb-actions {',
      '  display: flex;',
      '  justify-content: flex-end;',
      '  gap: 8px;',
      '  margin-top: 12px;',
      '}',
      '.dsh-rb-action {',
      '  height: 28px;',
      '  padding: 0 12px;',
      '  border: 0;',
      '  border-radius: 7px;',
      '  font-size: 12px;',
      '  cursor: pointer;',
      '  -webkit-app-region: no-drag;',
      '}',
      '.dsh-rb-action.ghost {',
      '  background: transparent;',
      '  color: var(--dsw-alias-label-secondary, inherit);',
      '}',
      '.dsh-rb-action.ghost:hover {',
      '  background: color-mix(in srgb, var(--dsw-alias-label-primary, #888) 12%, transparent);',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '}',
      '.dsh-rb-action.primary {',
      '  background: var(--dsw-alias-brand-primary, #4d6bfe);',
      '  color: #ffffff;',
      '  font-weight: 500;',
      '}',
      '.dsh-rb-action.primary:hover {',
      '  filter: brightness(1.06);',
      '}'
    ].join('\n')

    function ensureCss() {
      if (document.getElementById(STYLE_ID)) return
      var tag = document.createElement('style')
      tag.id = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function removeCss() {
      var tag = document.getElementById(STYLE_ID)
      if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
    }

    var TEXT = {
      zh: {
        title: '重启 DeepSeek Harness',
        body: '重启会关闭当前窗口并重新启动应用，正在运行的任务会被中断。',
        cancel: '取消',
        confirm: '立即重启',
        restarting: '正在重启…',
        failed: '重启没有发生，请重试，或手动退出后重新打开。'
      },
      en: {
        title: 'Restart DeepSeek Harness',
        body: 'This closes the current window and starts DeepSeek Harness again. Running tasks are interrupted.',
        cancel: 'Cancel',
        confirm: 'Restart now',
        restarting: 'Restarting…',
        failed: 'The restart did not happen. Try again, or quit and reopen manually.'
      }
    }

    function activeLocale(locale) {
      try {
        if (locale && typeof locale.getSnapshot === 'function') {
          var snapshot = locale.getSnapshot()
          if (snapshot && snapshot.active) return String(snapshot.active)
        }
      } catch (e) {}
      return (typeof navigator !== 'undefined' && navigator.language) || 'en'
    }

    function textFor(locale) {
      return activeLocale(locale).toLowerCase().indexOf('zh') === 0 ? TEXT.zh : TEXT.en
    }

    function readMetrics() {
      var root = document.documentElement
      var rect = null
      try {
        var overlay = navigator.windowControlsOverlay
        if (overlay && overlay.visible) rect = overlay.getTitlebarAreaRect()
      } catch (e) {}

      var height = rect && rect.height > 0
        ? rect.height
        : parseFloat(getComputedStyle(root).getPropertyValue('--dsh-windows-titlebar-height'))
      if (!isFinite(height) || height <= 0) height = 40

      // Distance from the window's right edge to the OS caption buttons.
      var inset = rect && isFinite(rect.width)
        ? Math.max(0, window.innerWidth - (rect.x + rect.width))
        : 138
      if (!isFinite(inset) || inset < 0) inset = 138

      return {
        right: inset,
        height: height,
        titlebar: root.hasAttribute('data-windows-titlebar'),
        fullscreen: root.hasAttribute('data-fullscreen')
      }
    }

    function icon(h) {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 15,
        height: 15,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false
      },
        h('path', { d: 'M12.9 5.2A5 5 0 1 0 13 8' }),
        h('path', { d: 'M13.7 2.3v3.2h-3.2' })
      )
    }

    function RestartButton(props) {
      var R = react()
      var h = R.createElement
      var text = textFor(props.locale)

      var metricsState = R.useState(readMetrics)
      var metrics = metricsState[0]
      var setMetrics = metricsState[1]

      var supportedState = R.useState(false)
      var supported = supportedState[0]
      var setSupported = supportedState[1]

      var openState = R.useState(false)
      var open = openState[0]
      var setOpen = openState[1]

      var phaseState = R.useState('idle')
      var phase = phaseState[0]
      var setPhase = phaseState[1]

      var errorState = R.useState('')
      var error = errorState[0]
      var setError = errorState[1]

      var anchor = R.useRef(null)

      // Probe once: the Host half answers whether this process can relaunch.
      R.useEffect(function () {
        var cancelled = false
        fetch(ENDPOINT, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' }
        }).then(function (response) {
          return response.ok ? response.json() : null
        }).then(function (value) {
          if (!cancelled) setSupported(!!(value && value.supported === true))
        }).catch(function () {
          if (!cancelled) setSupported(false)
        })
        return function () { cancelled = true }
      }, [])

      // Keep the button glued to the caption buttons as the window changes.
      R.useEffect(function () {
        function sync() { setMetrics(readMetrics()) }
        sync()
        window.addEventListener('resize', sync)
        var overlay = navigator.windowControlsOverlay
        if (overlay && typeof overlay.addEventListener === 'function') overlay.addEventListener('geometrychange', sync)
        var observer = new MutationObserver(sync)
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-windows-titlebar', 'data-fullscreen']
        })
        return function () {
          window.removeEventListener('resize', sync)
          if (overlay && typeof overlay.removeEventListener === 'function') overlay.removeEventListener('geometrychange', sync)
          observer.disconnect()
        }
      }, [])

      // Close the confirmation on outside pointer input or Escape.
      R.useEffect(function () {
        if (!open) return undefined
        function onPointerDown(event) {
          if (anchor.current && !anchor.current.contains(event.target)) setOpen(false)
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return function () {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      function startRestart() {
        if (phase === 'restarting') return
        setOpen(false)
        setError('')
        setPhase('restarting')
        var settled = false
        var watchdog = window.setTimeout(function () {
          if (settled) return
          settled = true
          setPhase('failed')
          setError(text.failed)
        }, WATCHDOG_MS)
        fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' }
        }).then(function (response) {
          return response.json().catch(function () { return null }).then(function (value) {
            if (response.ok) return value
            throw new Error((value && (value.error || value.reason)) || ('HTTP ' + response.status))
          })
        }).catch(function (failure) {
          if (settled) return
          settled = true
          window.clearTimeout(watchdog)
          setPhase('failed')
          setError(String(failure && failure.message ? failure.message : failure))
        })
      }

      if (!metrics.titlebar || metrics.fullscreen || !supported) return null

      var children = []

      if (phase === 'restarting') {
        children.push(h('span', { key: 'pill', className: 'dsh-rb-pill' },
          h('span', { className: 'dsh-rb-spinner' }),
          text.restarting
        ))
      } else {
        children.push(h('button', {
          key: 'button',
          type: 'button',
          className: 'dsh-rb-button',
          title: text.title,
          'aria-label': text.title,
          'aria-haspopup': 'dialog',
          'aria-expanded': open ? 'true' : 'false',
          style: { position: 'relative' },
          onClick: function (event) {
            event.stopPropagation()
            setOpen(!open)
          }
        },
          icon(h),
          phase === 'failed' ? h('span', { key: 'dot', className: 'dsh-rb-dot' }) : null
        ))
      }

      if (open && phase !== 'restarting') {
        children.push(h('div', {
          key: 'popover',
          className: 'dsh-rb-popover',
          role: 'dialog',
          'aria-modal': false,
          'aria-label': text.title,
          onPointerDown: function (event) { event.stopPropagation() }
        },
          h('p', { className: 'dsh-rb-title' }, text.title),
          h('p', { className: 'dsh-rb-body' }, text.body),
          error ? h('p', { className: 'dsh-rb-error' }, error) : null,
          h('div', { className: 'dsh-rb-actions' },
            h('button', {
              type: 'button',
              className: 'dsh-rb-action ghost',
              onClick: function () { setOpen(false) }
            }, text.cancel),
            h('button', {
              type: 'button',
              className: 'dsh-rb-action primary',
              onClick: startRestart
            }, text.confirm)
          )
        ))
      }

      return h('div', {
        ref: anchor,
        className: 'dsh-rb-anchor',
        style: {
          right: (metrics.right + 4) + 'px',
          height: metrics.height + 'px'
        }
      }, children)
    }

    function apply(ctx) {
      ensureCss()
      if (typeof ctx.effect === 'function') {
        ctx.effect(function () { return removeCss }, 'dsh-restart-button: stylesheet')
      }
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-restart-button',
          order: 80,
          label: function () { return 'Restart' },
          inject: function () {
            return { locale: ctx.locale }
          }
        }, RestartButton)
      })
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    return module.exports
  }
})
