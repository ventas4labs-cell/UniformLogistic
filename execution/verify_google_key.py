import os
import urllib.request
import json
import ssl

def load_env():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env_vars

def check_key():
    env = load_env()
    # Check for known keys
    key = env.get('GOOGLE_API_KEY') or env.get('Google_studio_API_KEY')
    
    if not key:
        print("Error: No GOOGLE_API_KEY or Google_studio_API_KEY found in .env")
        return

    print(f"Testing key: {key[:4]}...{key[-4:]}")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    
    try:
        # Create unverified context to bypass SSL cert issues common on macOS dev environments
        context = ssl._create_unverified_context()
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=context) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                print("Success: API Key is valid.")
                print(f"Available models count: {len(data.get('models', []))}")
                # Optional: print first model to prove it
                if data.get('models'):
                    print(f"Sample model: {data['models'][0]['name']}")
            else:
                print(f"Failed with status: {response.status}")
    except urllib.error.HTTPError as e:
        print(f"Error: API Key verification failed.")
        print(f"Status: {e.code}")
        print(f"Reason: {e.reason}")
        try:
            body = e.read().decode()
            print(f"Details: {body}")
        except:
            pass
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    check_key()
