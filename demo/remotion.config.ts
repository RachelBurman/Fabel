import { Config } from '@remotion/cli/config'
import path from 'path'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)

Config.overrideWebpackConfig((current) => {
  // __dirname is wrong inside Remotion's compiled config context (it resolves to
  // node_modules/@remotion/cli/dist). Use process.cwd() instead — Remotion sets
  // it to the Remotion root (demo/) before invoking overrideWebpackConfig.
  const demoRoot   = process.cwd()
  const parentRoot = path.resolve(demoRoot, '..')

  return {
    ...current,
    resolve: {
      ...current.resolve,
      alias: {
        // Spread Remotion's defaults first
        ...current.resolve?.alias,
        // Specific mocks BEFORE the general '@' alias so longer prefix wins
        'next-intl':                 path.resolve(demoRoot, 'src/mocks/next-intl.tsx'),
        'next/navigation':           path.resolve(demoRoot, 'src/mocks/next-navigation.ts'),
        '@/lib/fable-context':       path.resolve(demoRoot, 'src/mocks/fable-context.tsx'),
        '@/lib/hooks/use-insights':  path.resolve(demoRoot, 'src/mocks/use-insights.ts'),
        // General @/ alias LAST — resolves everything else under @/ to parent project
        '@': parentRoot,
      } as Record<string, string>,
    },
    module: {
      ...current.module,
      rules: [
        // Drop any existing CSS rule Remotion ships, then add ours with PostCSS
        ...(current.module?.rules ?? []).filter(
          (r) => !(r as { test?: RegExp }).test?.toString().includes('css')
        ),
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  // Use parent project's postcss config so Tailwind v4 processes correctly
                  config: parentRoot,
                },
              },
            },
          ],
        },
      ],
    },
  }
})
