import cairosvg

cairosvg.svg2png(url='public/icons/fable-leaf.svg', write_to='public/icons/icon-512.png', output_width=512, output_height=512)
print('✓ icon-512.png')

cairosvg.svg2png(url='public/icons/fable-leaf.svg', write_to='public/icons/icon-192.png', output_width=192, output_height=192)
print('✓ icon-192.png')

cairosvg.svg2png(url='public/icons/fable-leaf.svg', write_to='public/apple-icon.png', output_width=180, output_height=180)
print('✓ apple-icon.png')

print('Done.')
