from psd_tools import PSDImage

psd_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_5.psd'
output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_5_transparent.psd'
png_output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_5_transparent.png'

print(f"Opening {psd_path}...")
psd = PSDImage.open(psd_path)

layers_to_hide_top_level = ['Background', 'Shadows', 'Delete this layer', 'Design'] # Top level Design is supposedly hidden but we ensure it

for layer in psd:
    if layer.name in layers_to_hide_top_level:
        print(f"--> Hiding top-level layer: {layer.name}")
        layer.visible = False
    
    # Check for Mockup group/Design
    if layer.name == 'Mockup' and layer.is_group():
        for child in layer:
            if child.name == 'Design' and child.is_group():
                print(f"--> Hiding '{child.name}' group inside 'Mockup' (Screen Content)")
                child.visible = False

print(f"Saving to {output_path}...")
psd.save(output_path)
print(f"Saving preview to {png_output_path}...")
psd.composite().save(png_output_path)
print("Done.")
