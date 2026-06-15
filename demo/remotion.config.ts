import { Config } from '@remotion/cli/config'
import path from 'path'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)

Config.overrideWebpackConfig((current) => {
  return {
    ...current,
    resolve: {
      ...current.resolve,
      alias: {
        // Resolve @/ to the parent Next.js project root
        '@': path.resolve(__dirname, '..'),
        // Replace problematic Next.js / context hooks with thin mocks
        'next-intl':                       path.resolve(__dirname, 'src/mocks/next-intl.tsx'),
        'next/navigation':                 path.resolve(__dirname, 'src/mocks/next-navigation.ts'),
        '@/lib/fable-context':             path.resolve(__dirname, 'src/mocks/fable-context.tsx'),
        '@/lib/hooks/use-insights':        path.resolve(__dirname, 'src/mocks/use-insights.ts'),
        ...current.resolve?.alias,
      },
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
                  // Use the parent project's postcss config so Tailwind v4 resolves correctly
                  config: path.resolve(__dirname, '..'),
                },
              },
            },
          ],
        },
      ],
    },
  }
})
