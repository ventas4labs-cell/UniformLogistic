from psd_tools import PSDImage

psd_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_4.psd'
output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_4_cleaned.psd'
png_output_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_4_cleaned.png'

print(f"Opening {psd_path}...")
psd = PSDImage.open(psd_path)

def hide_layers_recursive(layers, names_to_hide):
    for layer in layers:
        print(f"Checking layer: {layer.name}")
        if layer.name in names_to_hide:
            print(f"--> Hiding layer: {layer.name}")
            layer.visible = False
        
        # Check specific nesting for the screen content
        # We know structure is Mockup -> Design (group) -> Design (smartobject)
        # We want to hide the 'Design' group inside 'Mockup'
        if layer.name == 'Mockup' and layer.is_group():
             for child in layer:
                 if child.name == 'Design' and child.is_group():
                     print(f"--> Hiding nested Design group inside Mockup")
                     child.visible = False
        
        # Recursion not strictly needed if we target specific nested paths, 
        # but good for general 'Delete this layer' search if it was nested.
        # However, provided structure shows 'Delete this layer' is top level.
        pass

# Hide top-level Delete this layer
found_delete = False
for layer in psd:
    if layer.name == 'Delete this layer':
        print("--> Hiding top-level 'Delete this layer'")
        layer.visible = False
        found_delete = True

# Hide the screen content
found_screen = False
for layer in psd:
    if layer.name == 'Mockup' and layer.is_group():
        for child in layer:
            if child.name == 'Design' and child.is_group():
                print("--> Hiding 'Design' group inside 'Mockup' (Phone Screen Content)")
                child.visible = False
                found_screen = True

if not found_delete:
    print("Warning: 'Delete this layer' not found at top level.")
if not found_screen:
    print("Warning: Screen content 'Design' group not found inside 'Mockup'.")

print(f"Saving to {output_path}...")
psd.save(output_path)
print(f"Saving preview to {png_output_path}...")
psd.composite().save(png_output_path)
print("Done.")
