import subprocess
import sys
import os

if __name__ == "__main__":
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    sys.exit(subprocess.call([sys.executable, "run.py"], cwd=backend_dir))
