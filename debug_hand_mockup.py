from psd_tools import PSDImage

psd_path = '/Users/juanchacon/Desktop/Free_Realistic_iPhone_16_Pro_in_Hand_Mockup.psd'
psd = PSDImage.open(psd_path)

# Save reference full
# psd.composite().save('debug_full.png') # Takes time, maybe skip if confident? Let's do it to be safe.

# Find the specific layer
screen_layer = None
for layer in psd:
    if layer.name == 'Change This':
        screen_layer = layer
        break

if not screen_layer:
    print("Screen layer not found")
    exit()

print(f"Screen Layer BBox: {screen_layer.bbox}")

# Export Screen Only (to know geometry/mask)
# We can just extract the layer image itself (composition of just that layer)
screen_layer_img = screen_layer.composite()
screen_layer_img.save('debug_screen_only.png')

# Export "Frame" (Everything else)
# We hide the screen layer and save the rest
screen_layer.visible = False
frame_img = psd.composite()
frame_img.save('debug_frame_no_screen.png')

print("Saved debug images.")
