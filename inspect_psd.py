from psd_tools import PSDImage

def print_layer(layer, indent=0):
    print(f"{'  ' * indent}- {layer.name} (Kind: {layer.kind}, Visible: {layer.visible}, Opacity: {layer.opacity})")
    if layer.is_group():
        for child in layer:
            print_layer(child, indent + 1)

psd_path = '/Users/juanchacon/Downloads/MD942_Free_iPhone16_Mockup/Free_iPhone_16_Mockup_1.psd'
print(f"Inspecting: {psd_path}")
try:
    psd = PSDImage.open(psd_path)
    for layer in psd:
        print_layer(layer)
except Exception as e:
    print(f"Error opening PSD: {e}")
