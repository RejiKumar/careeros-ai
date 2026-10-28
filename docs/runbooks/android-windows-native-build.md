# Android Native Build on Windows

`react-native-reanimated`'s C++ (`externalNativeBuildRelease`) failed on this
Windows machine with an infinite CMake regeneration loop. This records the root
cause and the fix.

## Symptom

Gradle stalls in the reanimated CMake task, repeating:

```text
[0/2] Re-checking globbed directories...
[1/2] Re-running CMake...
ninja: error: .../CMakeFiles/cmake.verify_globs is dirty
```

`ninja -d explain` in
`.cxx/RelWithDebInfo/<hash>/arm64-v8a` reported
`CMakeFiles/VerifyGlobs.cmake_force ... of phony edge with no inputs doesn't
exist` and `VerifyGlobs.cmake_force is dirty`.

## Root cause

Reanimated declares its sources with `file(GLOB_RECURSE ... CONFIGURE_DEPENDS
...)`. CMake implements that with a `cmake.verify_globs` step that re-runs CMake
whenever the glob appears changed. The **Ninja 1.10.2 bundled in the Android SDK
CMake** does not handle this verification correctly on Windows, so it reports the
force edge dirty forever and re-runs CMake on every invocation — the loop never
settles.

## Fix

Upgrade the Ninja **binary bundled with the SDK CMake** (this is the toolchain
layer, not app code, so it does not belong in the repo):

1. Download `ninja-win.zip` (v1.12.1+) from
   <https://github.com/ninja-build/ninja/releases>.
2. Back up and replace the bundled Ninja in every CMake version AGP may select:
   ```powershell
   $sdk = "$env:LOCALAPPDATA\Android\Sdk\cmake"
   foreach ($v in @("3.22.1","3.30.5")) {
     $p = "$sdk\$v\bin\ninja.exe"
     Copy-Item $p "$p.bak"
     Copy-Item "C:\path\to\new\ninja.exe" $p -Force
     & $p --version   # must print 1.12.1+
   }
   ```
3. Delete the CMake caches so the glob state is regenerated:
   ```powershell
   Get-ChildItem "apps\mobile\node_modules","apps\mobile\android" -Directory -Recurse -Filter ".cxx" |
     Remove-Item -Recurse -Force
   ```
4. Rebuild:
   ```powershell
   cd apps\mobile\android
   .\gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
   ```

A `ninja: warning: build log version is too old; starting over` line in the
output confirms the upgraded Ninja is in use. Verified 2026-10-13:
`BUILD SUCCESSFUL`, `app/build/outputs/apk/release/app-release.apk` (52 MB).

## Notes

- Ninja 1.12.0+ is the upstream fix for Windows long-path handling
  (ninja#1900). Windows long paths (`LongPathsEnabled`) and a whitespace-free
  project path are also recommended by Reanimated, but were **not** required
  here: CMake writes relative object paths (≈125 chars), well under
  `CMAKE_OBJECT_PATH_MAX`.
- A stale `ninja.exe` on `PATH` (e.g. `C:\Strawberry\c\bin\ninja.exe`) is
  irrelevant — AGP invokes Ninja by absolute path from `CMAKE_MAKE_PROGRAM`.
- This is a machine-local toolchain change; CI/EAS Linux builders are unaffected.
