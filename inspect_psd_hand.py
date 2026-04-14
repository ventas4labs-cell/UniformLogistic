from psd_tools import PSDImage

def print_layer(layer, indent=0):
    print(f"{'  ' * indent}- {layer.name} (Kind: {layer.kind}, Visible: {layer.visible}, Opacity: {layer.opacity}, Blend: {layer.blend_mode})")
    if layer.is_group():
        for child in layer:
            print_layer(child, indent + 1)

psd_path = '/Users/juanchacon/Desktop/Free_Realistic_iPhone_16_Pro_in_Hand_Mockup.psd'
print(f"Inspecting: {psd_path}")
try:
    psd = PSDImage.open(psd_path)
    print(f"Size: {psd.size}")
    for layer in psd:
        print_layer(layer)
except Exception as e:
    print(f"Error opening PSD: {e}")
