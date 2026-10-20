; TEST BUILDS ONLY (used to test the installer under Wine on Linux).
; Wine's tasklist makes the "is RxDesk running?" check always answer yes, so it is skipped here.
; The real installer (npm run dist) keeps the normal check.
!macro customCheckAppRunning
!macroend
