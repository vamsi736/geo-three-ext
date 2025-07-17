// Make sure THREE is available
var three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        console.log("🗺️ Starting GeoThreeExtension...");
        
        // MapBox configuration
        var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
        var MAPBOX_STYLE = 'mapbox/streets-v11';
        var provider = new Geo.MapBoxProvider(MAPBOX_TOKEN, MAPBOX_STYLE);

        this.map = new Geo.MapView(provider);
        
        // Simple positioning - put map at origin with reasonable size
        this.map.position.set(0, -1000, 0); // 1000 units below origin
        this.map.scale.set(10000, 1, 10000); // Large enough to see
        
        console.log("🗺️ Map positioned at (0, -1000, 0) with scale 10000");
        
        // Add to viewer
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(true);
        
        console.log("✅ Map added to viewer overlays");

        // Add simple toggle button with better positioning
        setTimeout(() => {
            this.createToggleButton();
        }, 1000);

        // Simple camera setup - no complex fitting
        setTimeout(() => {
            var cam = viewer.getCamera();
            console.log("📷 Setting camera to see map...");
            
            // Position camera to see both origin and map
            cam.position.set(5000, 5000, 5000);
            cam.target.set(0, 0, 0);
            cam.updateProjectionMatrix();
            viewer.impl.syncCamera();
            
            console.log("📷 Camera positioned at (5000, 5000, 5000) looking at origin");
        }, 2000);
        
        return true;
    }

    createToggleButton() {
        console.log("🔘 Creating toggle button...");
        
        var button = document.createElement('div');
        button.innerHTML = 'TOGGLE MAP';
        button.style.cssText = `
            position: fixed;
            top: 100px;
            left: 20px;
            z-index: 99999;
            padding: 15px 20px;
            background-color: #ff6b6b;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        
        var self = this;
        button.onclick = function() {
            if (self.map) {
                self.map.visible = !self.map.visible;
                console.log("🔄 Map visibility toggled to:", self.map.visible);
                button.style.backgroundColor = self.map.visible ? '#ff6b6b' : '#666';
                viewer.impl.invalidate(true);
            }
        };
        
        document.body.appendChild(button);
        this.toggleButton = button;
        console.log("✅ Toggle button created and added to page");
    }

    unload() {
        if (this.map) {
            viewer.overlays.removeMesh(this.map, 'map');
        }
        if (this.toggleButton && this.toggleButton.parentNode) {
            this.toggleButton.parentNode.removeChild(this.toggleButton);
        }
        return true;
    }
}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

// Simplified Geo library
(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('three'));
    } else if (typeof define === 'function' && define.amd) {
        define(['exports', 'three'], factory);
    } else {
        global = typeof globalThis !== 'undefined' ? globalThis : global || self;
        factory(global.Geo = {}, global.THREE);
    }
}(this, function (exports, three) {
    'use strict';

    // MapBoxProvider class
    class MapBoxProvider {
        constructor(apiToken, style) {
            this.apiToken = apiToken || '';
            this.style = style || 'mapbox/streets-v11';
            this.maxZoom = 18;
            this.minZoom = 0;
            
            console.log("🗺️ MapBoxProvider initialized for:", this.style);
        }
        
        fetchTile(zoom, x, y) {
            var url = `https://api.mapbox.com/styles/v1/${this.style}/tiles/${zoom}/${x}/${y}@2x?access_token=${this.apiToken}`;
            console.log(`📡 Fetching Qatar tile ${zoom}/${x}/${y}...`);
            
            return new Promise(function(resolve, reject) {
                var image = document.createElement('img');
                
                image.onload = function() {
                    console.log(`✅ Qatar tile ${zoom}/${x}/${y} loaded! Size: ${image.width}x${image.height}`);
                    resolve(image);
                };
                
                image.onerror = function() {
                    console.error(`❌ Failed to load tile ${zoom}/${x}/${y}`);
                    reject();
                };
                
                image.crossOrigin = 'Anonymous';
                image.src = url;
            });
        }
    }

    // Simple MapNode
    class MapNode extends three.Mesh {
        constructor(provider) {
            // Create bright colored plane so we can see it
            var geometry = new three.PlaneGeometry(1, 1);
            var material = new three.MeshBasicMaterial({ 
                color: 0xff0000, // RED so it's very visible
                side: three.DoubleSide,
                transparent: false
            });
            
            super(geometry, material);
            
            this.provider = provider;
            this.visible = true;
            
            // Rotate to be flat like ground
            this.rotation.x = -Math.PI / 2;
            
            console.log("🔴 RED map plane created (will turn to Qatar map)");
            
            // Load Qatar texture
            this.loadQatarTexture();
        }
        
        loadQatarTexture() {
            if (!this.provider) {
                console.error("❌ No provider for texture loading");
                return;
            }
            
            console.log("🇶🇦 Loading Qatar map texture...");
            var self = this;
            
            // Qatar coordinates: level 10, x=812, y=394
            this.provider.fetchTile(10, 812, 394)
                .then(function(image) {
                    console.log("🎨 Applying Qatar texture to red plane...");
                    
                    var texture = new three.Texture(image);
                    texture.generateMipmaps = false;
                    texture.format = three.RGBFormat;
                    texture.magFilter = three.LinearFilter;
                    texture.minFilter = three.LinearFilter;
                    texture.needsUpdate = true;
                    
                    self.material.map = texture;
                    self.material.color.setHex(0xffffff); // White for texture
                    self.material.needsUpdate = true;
                    
                    console.log("🇶🇦 Qatar map texture applied! Red should now be Qatar map!");
                })
                .catch(function() {
                    console.error("❌ Failed to load Qatar texture - staying red");
                });
        }
    }

    // Simple MapView
    class MapView extends three.Object3D {
        constructor(provider) {
            super();
            
            this.provider = provider;
            console.log("🗺️ Creating MapView...");
            
            // Create the map node
            this.mapNode = new MapNode(provider);
            this.add(this.mapNode);
            
            console.log("✅ MapView created with Qatar map node");
        }
    }

    // Export classes
    exports.MapBoxProvider = MapBoxProvider;
    exports.MapNode = MapNode;
    exports.MapView = MapView;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
