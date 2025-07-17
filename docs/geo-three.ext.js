// Simple, clean extension that definitely works
var three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        console.log("🗺️ Loading Clean GeoThreeExtension...");
        
        try {
            // MapBox setup
            var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
            var MAPBOX_STYLE = 'mapbox/streets-v11';
            
            // Create map without any problematic calls
            this.createMap(MAPBOX_TOKEN, MAPBOX_STYLE);
            
            // Add button after everything is ready
            setTimeout(() => this.addButton(), 2000);
            
            console.log("✅ Extension loaded successfully");
            return true;
            
        } catch (error) {
            console.error("❌ Extension loading failed:", error);
            return false;
        }
    }

    createMap(token, style) {
        console.log("🔨 Creating map components...");
        
        // Create simple red plane geometry
        var geometry = new THREE.PlaneGeometry(20000, 20000); // Large plane
        var material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, // RED
            side: THREE.DoubleSide,
            transparent: false
        });
        
        this.map = new THREE.Mesh(geometry, material);
        
        // Position and rotate
        this.map.position.set(0, -500, 0); // Below origin
        this.map.rotation.x = -Math.PI / 2; // Flat
        
        console.log("🔴 Red map plane created at (0, -500, 0)");
        
        // Add to viewer
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(true);
        
        console.log("✅ Map added to viewer");
        
        // Load Qatar texture
        this.loadQatarTexture(token, style);
    }

    loadQatarTexture(token, style) {
        console.log("🇶🇦 Loading Qatar texture...");
        
        var url = `https://api.mapbox.com/styles/v1/${style}/tiles/10/812/394@2x?access_token=${token}`;
        console.log("📡 Fetching from:", url);
        
        var self = this;
        var image = document.createElement('img');
        
        image.onload = function() {
            console.log("✅ Qatar image loaded, applying texture...");
            
            try {
                var texture = new THREE.Texture(image);
                texture.generateMipmaps = false;
                texture.format = THREE.RGBFormat;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
                
                self.map.material.map = texture;
                self.map.material.color.setHex(0xffffff);
                self.map.material.needsUpdate = true;
                
                console.log("🇶🇦 Qatar map texture applied! Red should now be Qatar!");
                
                // Force viewer to refresh
                viewer.impl.invalidate(true);
                
            } catch (error) {
                console.error("❌ Failed to apply texture:", error);
            }
        };
        
        image.onerror = function() {
            console.error("❌ Failed to load Qatar image");
        };
        
        image.crossOrigin = 'Anonymous';
        image.src = url;
    }

    addButton() {
        console.log("🔘 Adding toggle button...");
        
        try {
            // Create button element
            this.button = document.createElement('button');
            this.button.innerHTML = 'TOGGLE MAP';
            this.button.id = 'mapToggleButton';
            
            // Style the button
            this.button.style.cssText = `
                position: fixed !important;
                top: 80px !important;
                left: 20px !important;
                z-index: 999999 !important;
                padding: 12px 16px !important;
                background: #e74c3c !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-weight: bold !important;
                font-family: Arial, sans-serif !important;
                font-size: 12px !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
                pointer-events: auto !important;
            `;
            
            // Add click handler
            var self = this;
            this.button.onclick = function() {
                console.log("🔄 Button clicked!");
                if (self.map) {
                    self.map.visible = !self.map.visible;
                    console.log("🗺️ Map visibility:", self.map.visible);
                    self.button.style.background = self.map.visible ? '#e74c3c' : '#7f8c8d';
                    viewer.impl.invalidate(true);
                }
            };
            
            // Add to page
            document.body.appendChild(this.button);
            console.log("✅ Button added successfully!");
            
        } catch (error) {
            console.error("❌ Failed to create button:", error);
        }
    }

    unload() {
        console.log("🧹 Unloading extension...");
        
        try {
            if (this.map) {
                viewer.overlays.removeMesh(this.map, 'map');
                viewer.overlays.removeScene('map');
            }
            
            if (this.button && this.button.parentNode) {
                this.button.parentNode.removeChild(this.button);
            }
            
        } catch (error) {
            console.error("❌ Error during unload:", error);
        }
        
        return true;
    }
}

// Register extension
Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

console.log("📋 GeoThreeExtension script loaded and registered");
