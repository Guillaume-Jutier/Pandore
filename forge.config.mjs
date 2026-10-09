import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config = {
  packagerConfig: {
    asar: true,
    // Lowercase program name (pandore.exe, /usr/bin/pandore), as Linux packages expect.
    // The name shown to users stays "Pandore" (productName in package.json).
    executableName: 'pandore',
    appCopyright: 'Copyright (c) 2026 Guillaume Jutier — licence MIT',
  },
  rebuildConfig: {},
  makers: [
    // Windows: Pandore-x.y.z Setup.exe (installs for the current user, no admin rights)
    new MakerSquirrel({}),
    // macOS: zip containing Pandore.app
    new MakerZIP({}, ['darwin']),
    // Linux: .rpm (Fedora) and .deb (Ubuntu, Debian)
    new MakerRpm({ options: { homepage: 'https://junior-conseil.audencia.com' } }),
    new MakerDeb({ options: { homepage: 'https://junior-conseil.audencia.com' } }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.js',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.js',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
