// Make sure THREE is available
var three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        console.log("🗺️ Loading GeoThreeExtension...");
        
        // MapBox configuration
        var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
        var MAPBOX_STYLE = 'mapbox/streets-v11';
        var provider = new Geo.MapBoxProvider(MAPBOX_TOKEN, MAPBOX_STYLE, Geo.MapBoxProvider.STYLE);

        this.map = new Geo.MapView(Geo.MapView.PLANAR, provider);
        
        // Get model bounds to position map correctly
        var modelBounds = viewer.model.getBoundingBox();
        var modelCenter = modelBounds.center();
        var modelSize = modelBounds.getSize();
        
        console.log("📦 Model center:", modelCenter);
        console.log("📏 Model size:", modelSize);
        console.log("🔽 Model min Y (bottom):", modelBounds.min.y);
        console.log("🔼 Model max Y (top):", modelBounds.max.y);
        
        // Position map BELOW the model (so model sits ON TOP of map)
        var mapY = modelBounds.min.y - 50; // Put map 50 units below model bottom
        this.map.position.set(modelCenter.x, mapY, modelCenter.z);
        
        // Scale map to be larger than model
        var mapScale = Math.max(modelSize.x, modelSize.z) * 3;
        this.map.scale.set(mapScale, 1, mapScale);
        
        console.log("🗺️ Map positioned at:", this.map.position);
        console.log("📐 Map scaled to:", mapScale);
        
        // Add to viewer
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(false);
        
        console.log("✅ Map added to viewer");

        // Force camera to see the scene properly
        setTimeout(function() {
            viewer.fitToView();
            console.log("📷 Camera fitted to view");
        }, 2000);

        // Camera setup
        viewer.autocam.shotParams.destinationPercent = 3;
        viewer.autocam.shotParams.duration = 3;
        
        // Event listener for camera changes
        var self = this;
        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, function() {
            viewer.autocam.toPerspective();
            if (self.map && self.map.lod) {
                self.map.lod.updateLOD(self.map, cam, viewer.impl.glrenderer(), viewer.overlays.impl.overlayScenes.map.scene, viewer.impl);
            }
        });

        // Add button to toggle map visibility for testing
        this.createMapToggleButton();
        
        return true;
    }

    createMapToggleButton() {
        var self = this;
        var button = document.createElement('button');
        button.innerHTML = 'Toggle Map';
        button.style.position = 'absolute';
        button.style.top = '70px';
        button.style.left = '10px';
        button.style.zIndex = '1000';
        button.style.padding = '10px';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        
        button.onclick = function() {
            self.map.visible = !self.map.visible;
            console.log("🔄 Map visibility:", self.map.visible);
        };
        
        document.body.appendChild(button);
        this.toggleButton = button;
    }

    unload() {
        if (this.map) {
            viewer.overlays.removeMesh(this.map, 'map');
        }
        if (this.toggleButton) {
            document.body.removeChild(this.toggleButton);
        }
        return true;
    }
}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

// Create the Geo library
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

    // UnitsUtils class
    class UnitsUtils {
        static datumsToSpherical(latitude, longitude) {
            var EARTH_ORIGIN = 20037508.342789244;
            var x = longitude * EARTH_ORIGIN / 180.0;
            var y = Math.log(Math.tan((90 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
            y = y * EARTH_ORIGIN / 180.0;
            return new three.Vector2(x, y);
        }
    }

    // MapBoxProvider class with better debugging
    class MapBoxProvider {
        constructor(apiToken, id, mode, format, useHDPI, version) {
            this.apiToken = apiToken || '';
            this.format = format || 'png';
            this.useHDPI = useHDPI || false;
            this.mode = mode || 100;
            this.mapId = id || '';
            this.style = id || '';
            this.version = version || 'v4';
            this.maxZoom = 18;
            this.minZoom = 0;
            
            console.log("🗺️ MapBoxProvider created with style:", this.style);
        }
        
        fetchTile(zoom, x, y) {
            // Use a simpler URL format that works better
            var url = 'https://api.mapbox.com/styles/v1/' + this.style + '/tiles/' + zoom + '/' + x + '/' + y + '@2x?access_token=' + this.apiToken;
            console.log('📡 Fetching tile from URL:', url);
            
            return new Promise(function(resolve, reject) {
                var image = document.createElement('img');
                
                image.onload = function() {
                    console.log('✅ Tile loaded successfully:', zoom, x, y);
                    console.log('🖼️ Image dimensions:', image.width, 'x', image.height);
                    resolve(image);
                };
                
                image.onerror = function(error) {
                    console.error('❌ Failed to load tile:', zoom, x, y);
                    console.error('🔗 Failed URL:', url);
                    console.error('📄 Error details:', error);
                    reject(error);
                };
                
                image.crossOrigin = 'Anonymous';
                image.src = url;
            });
        }
    }

    // MapNode class with better texture handling
    class MapNode extends three.Mesh {
        constructor(parentNode, mapView, location, level, x, y, geometry, material) {
            super(geometry, material);
            this.mapView = mapView;
            this.parentNode = parentNode;
            this.location = location || -1;
            this.level = level || 0;
            this.x = x || 0;
            this.y = y || 0;
            this.isMesh = true;
            this.visible = true;
            
            console.log('🔲 MapNode created for Qatar tile:', this.level, this.x, this.y);
            
            this.initialize();
        }
        
        initialize() {
            // Give it a moment before loading texture
            var self = this;
            setTimeout(function() {
                self.loadTexture();
            }, 500);
        }
        
        loadTexture() {
            if (!this.mapView || !this.mapView.provider) {
                console.error('❌ No provider available for texture loading');
                return;
            }
            
            console.log('🔄 Starting texture load for Qatar...');
            var self = this;
            
            this.mapView.provider.fetchTile(this.level, this.x, this.y)
                .then(function(image) {
                    console.log('🎨 Creating texture from loaded image...');
                    var texture = new three.Texture(image);
                    texture.generateMipmaps = false;
                    texture.format = three.RGBFormat;
                    texture.magFilter = three.LinearFilter;
                    texture.minFilter = three.LinearFilter;
                    texture.needsUpdate = true;
                    
                    // Apply texture and change color to white
                    self.material.map = texture;
                    self.material.color.setHex(0xffffff);
                    self.material.needsUpdate = true;
                    
                    console.log('✅ Qatar map texture successfully applied!');
                    console.log('🗺️ You should now see Qatar map instead of green');
                })
                .catch(function(error) {
                    console.error('❌ Texture loading failed - keeping green color');
                    console.error('🔍 Error details:', error);
                });
        }
    }

    // LOD class
    class LODRaycast {
        constructor() {
            this.raycaster = new three.Raycaster();
            console.log('🎯 LODRaycast created');
        }
        
        updateLOD(view, camera, renderer, scene, viewerImpl) {
            return;
        }
    }

    // MapView class
    class MapView extends three.Mesh {
        constructor(root, provider, heightProvider) {
            super();
            this.lod = new LODRaycast();
            this.provider = provider;
            this.heightProvider = heightProvider;
            this.root = null;
            
            console.log('🗺️ MapView created');
            
            this.setRoot(root);
        }
        
        setRoot(root) {
            console.log('🌳 Setting up Qatar map root node...');
            
            // Create a larger plane geometry
            var geometry = new three.PlaneGeometry(1, 1, 1, 1);
            var material = new three.MeshBasicMaterial({ 
                color: 0x00ff00, // Start green
                side: three.DoubleSide,
                transparent: false,
                wireframe: false
            });
            
            if (this.root !== null) {
                this.remove(this.root);
                this.root = null;
            }
            
            // Create root node for Qatar with correct coordinates
            this.root = new MapNode(null, this, -1, 10, 812, 394, geometry, material);
            
            if (this.root !== null) {
                // Rotate to lay flat like ground
                this.root.rotation.x = -Math.PI / 2;
                
                this.geometry = this.root.geometry;
                this.root.mapView = this;
                this.add(this.root);
                console.log('✅ Qatar map root node created and positioned');
            }
        }
        
        raycast(raycaster, intersects) {
            return false;
        }
    }

    // Constants
    MapView.PLANAR = 200;
    MapView.SPHERICAL = 201;
    MapView.HEIGHT = 202;
    MapView.HEIGHT_SHADER = 203;
    
    MapBoxProvider.STYLE = 100;
    MapBoxProvider.MAP_ID = 101;

    // Export everything
    exports.UnitsUtils = UnitsUtils;
    exports.MapBoxProvider = MapBoxProvider;
    exports.MapNode = MapNode;
    exports.LODRaycast = LODRaycast;
    exports.MapView = MapView;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
