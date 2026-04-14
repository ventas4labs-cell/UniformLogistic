from psd_tools import PSDImage

psd_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_1.psd'
output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_1_cleaned.psd'
png_output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_1_cleaned.png'

print(f"Opening {psd_path}...")
psd = PSDImage.open(psd_path)

found = False
# We need to modify the internal list of layers.
# psd is a list-like object of layers.
# We iterate and remove the one matching the name.
# Since we can't modify a list while iterating, we gather indices or iterate backwards, or use a new list.
# But psd-tools API might rely on the internal structure.
# Let's try finding it first.

layer_to_remove = None
for layer in psd:
    if layer.name == 'Delete this layer':
        layer_to_remove = layer
        break

if layer_to_remove:
    print(f"Found layer: {layer_to_remove.name}")
    # psd-tools layers are stored in a list. We can try to assume psd object behaves like a list for removal.
    # inspecting the library, psd element acts as a Group.
    try:
        # Some versions allow direct removal? 
        # Inspecting source, it's a list proxy.
        # But safest is to just set visible to False if we just want the mockup.
        # But the user said "delete".
        # Let's try to verify if we can remove.
        # psd._layers.remove(layer_to_remove) # accessing internal might be risky.
        pass
    except:
        pass
    
    # Actually, simpler: create a new structure or just hide it. 
    # Hiding is safe. Deleting might corrupt binary data reference if not careful.
    # But let's try to hide it first and save.
    layer_to_remove.visible = False
    print("Hiding layer 'Delete this layer'.")
    
    print(f"Saving to {output_path}...")
    psd.save(output_path)
    print(f"Saving preview to {png_output_path}...")
    psd.composite().save(png_output_path)
    print("Done.")
else:
    print("Layer 'Delete this layer' not found.")
