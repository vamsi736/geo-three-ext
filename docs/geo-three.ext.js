// Make sure THREE is available
var three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        console.log("🗺️ Loading GeoThreeExtension...");
        
        // MapBox configuration
        var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
        var MAPBOX_STYLE = 'mapbox/streets-v11';
        var provider = new Geo.MapBoxProvider(MAPBOX_TOKEN, MAPBOX_STYLE, Geo.MapBoxProvider.STYLE);

        // FIXED: Properly declare this.map
        this.map = new Geo.MapView(Geo.MapView.PLANAR, provider);
        
        // Qatar coordinates
        var dohaLat = 25.276987;
        var dohaLon = 51.520008;
        var coords = Geo.UnitsUtils.datumsToSpherical(dohaLat, dohaLon);
        
        console.log("📍 Qatar coordinates:", coords);
        
        // Position map at origin first to test
        this.map.position.set(0, 0, 0);
        
        // Add to viewer
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(false);
        
        console.log("✅ Map added to viewer");

        // Camera setup
        viewer.autocam.shotParams.destinationPercent = 3;
        viewer.autocam.shotParams.duration = 3;
        
        var cam = viewer.getCamera();
        console.log("📷 Camera ready");
        
        // Event listener for camera changes
        var self = this;
        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, function() {
            viewer.autocam.toPerspective();
            if (self.map && self.map.lod) {
                self.map.lod.updateLOD(self.map, cam, viewer.impl.glrenderer(), viewer.overlays.impl.overlayScenes.map.scene, viewer.impl);
            }
        });
        
        return true;
    }

    unload() {
        if (this.map) {
            viewer.overlays.removeMesh(this.map, 'map');
        }
        return true;
    }
}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

// Create the Geo library with proper structure
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

    // MapBoxProvider class
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
            
            console.log("🗺️ MapBoxProvider created");
        }
        
        fetchTile(zoom, x, y) {
            var url = 'https://api.mapbox.com/styles/v1/' + this.style + '/tiles/' + zoom + '/' + x + '/' + y + '?access_token=' + this.apiToken;
            console.log('📡 Fetching tile:', zoom, x, y);
            
            return new Promise(function(resolve, reject) {
                var image = document.createElement('img');
                
                image.onload = function() {
                    console.log('✅ Tile loaded:', zoom, x, y);
                    resolve(image);
                };
                
                image.onerror = function() {
                    console.error('❌ Failed to load tile:', zoom, x, y);
                    reject();
                };
                
                image.crossOrigin = 'Anonymous';
                image.src = url;
            });
        }
    }

    // Simple MapNode class
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
            
            console.log('🔲 MapNode created:', this.level, this.x, this.y);
            
            this.initialize();
        }
        
        initialize() {
            this.loadTexture();
        }
        
        loadTexture() {
            if (!this.mapView || !this.mapView.provider) {
                console.error('❌ No provider available');
                return;
            }
            
            var self = this;
            this.mapView.provider.fetchTile(this.level, this.x, this.y)
                .then(function(image) {
                    var texture = new three.Texture(image);
                    texture.generateMipmaps = false;
                    texture.format = three.RGBFormat;
                    texture.magFilter = three.LinearFilter;
                    texture.minFilter = three.LinearFilter;
                    texture.needsUpdate = true;
                    self.material.map = texture;
                    self.material.needsUpdate = true;
                    console.log('✅ Texture applied');
                })
                .catch(function() {
                    console.error('❌ Texture loading failed');
                });
        }
    }

    // Simple LOD class
    class LODRaycast {
        constructor() {
            this.raycaster = new three.Raycaster();
            console.log('🎯 LODRaycast created');
        }
        
        updateLOD(view, camera, renderer, scene, viewerImpl) {
            // Simple LOD - just return for now
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
            console.log('🌳 Setting up root node');
            
            // Create simple plane geometry
            var geometry = new three.PlaneGeometry(1000000, 1000000, 1, 1);
            var material = new three.MeshBasicMaterial({ 
                color: 0x00ff00,
                side: three.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            
            if (this.root !== null) {
                this.remove(this.root);
                this.root = null;
            }
            
            // Create root node for Qatar (level 10, x=812, y=394)
            this.root = new MapNode(null, this, -1, 10, 812, 394, geometry, material);
            
            if (this.root !== null) {
                this.geometry = this.root.geometry;
                this.root.mapView = this;
                this.add(this.root);
                console.log('✅ Root node added');
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
