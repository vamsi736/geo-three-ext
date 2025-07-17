three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        console.log("🗺️ Loading GeoThreeExtension...");
        
        var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
        var MAPBOX_STYLE = 'mapbox/streets-v11';
        var provider = new Geo.MapBoxProvider(MAPBOX_TOKEN, MAPBOX_STYLE, Geo.MapBoxProvider.STYLE);

        this.map = new Geo.MapView(Geo.MapView.PLANAR, provider);
        
        // Qatar coordinates - Doha city center
        const dohaLat = 25.276987;
        const dohaLon = 51.520008;
        const coords = Geo.UnitsUtils.datumsToSpherical(dohaLat, dohaLon);
        
        console.log("📍 Qatar coordinates:", { dohaLat, dohaLon });
        console.log("🌐 Converted coordinates:", coords);
        
        // Try positioning map at origin first to see if it loads
        this.map.position.set(0, 0, 0);
        console.log("🗺️ Map positioned at origin");
        
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(false);
        
        console.log("✅ Map added to viewer overlays");

        // Get current model position for reference
        const modelBounds = viewer.model.getBoundingBox();
        console.log("📦 Model bounds:", modelBounds);

        // Camera settings
        viewer.autocam.shotParams.destinationPercent = 3;
        viewer.autocam.shotParams.duration = 3;
        var cam = viewer.getCamera();
        
        console.log("📷 Current camera position:", cam.position);
        console.log("🎯 Current camera target:", cam.target);

        // Don't change camera initially - let's see what we have
        
        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
            viewer.autocam.toPerspective();
            this.map.lod.updateLOD(this.map, cam, viewer.impl.glrenderer(), viewer.overlays.impl.overlayScenes.map.scene, viewer.impl);
        });
        
        // Add a timeout to check map loading status
        setTimeout(() => {
            console.log("🔍 Checking map status after 3 seconds...");
            console.log("Map visible:", this.map.visible);
            console.log("Map children count:", this.map.children.length);
            if (this.map.root) {
                console.log("Root node visible:", this.map.root.visible);
                console.log("Root node material:", this.map.root.material);
            }
        }, 3000);
        
        return true;
    }

    unload() {
        viewer.overlays.removeMesh(this.map, 'map');
        return true;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

// Simplified MapPlaneNode with debugging
class MapPlaneNode extends three.Mesh {
    constructor(parentNode = null, mapView = null, location = -1, level = 1, x = 0, y = 0) {
        // Create simple plane geometry
        const geometry = new three.PlaneGeometry(1, 1, 1, 1);
        const material = new three.MeshBasicMaterial({ 
            color: 0x00ff00, // Green color so we can see it
            side: three.DoubleSide, 
            transparent: true,
            opacity: 0.5
        });
        
        super(geometry, material);
        
        this.mapView = mapView;
        this.parentNode = parentNode;
        this.location = location;
        this.level = level;
        this.x = x;
        this.y = y;
        this.isMesh = true;
        this.visible = true; // Make sure it's visible
        
        console.log(`🔲 Created MapPlaneNode: level=${level}, x=${x}, y=${y}`);
        
        this.initialize();
    }
    
    initialize() {
        console.log("🔄 Initializing MapPlaneNode...");
        // For now, just use green color to see if geometry shows up
        // We'll add texture loading later once we confirm the geometry works
        this.loadTexture();
    }
    
    loadTexture() {
        console.log(`📥 Loading texture for tile: ${this.level}/${this.x}/${this.y}`);
        
        if (!this.mapView || !this.mapView.provider) {
            console.error("❌ No map provider available");
            return;
        }
        
        this.mapView.provider.fetchTile(this.level, this.x, this.y).then((image) => {
            console.log("✅ Texture loaded successfully");
            const texture = new three.Texture(image);
            texture.generateMipmaps = false;
            texture.format = three.RGBFormat;
            texture.magFilter = three.LinearFilter;
            texture.minFilter = three.LinearFilter;
            texture.needsUpdate = true;
            this.material.map = texture;
            this.material.color.setHex(0xffffff); // Reset color to white when texture loads
            this.material.needsUpdate = true;
        }).catch((error) => {
            console.error("❌ Failed to load texture:", error);
            // Keep green color if texture fails
        });
    }
    
    raycast(raycaster, intersects) {
        return super.raycast(raycaster, intersects);
    }
}

// Simplified MapView
class MapView extends three.Mesh {
    constructor(root = 200, provider = null, heightProvider = null) {
        super();
        
        this.lod = null;
        this.provider = provider;
        this.heightProvider = heightProvider;
        this.root = null;
        
        console.log("🗺️ Creating MapView...");
        
        this.setRoot(root);
    }
    
    setRoot(root) {
        console.log("🌳 Setting up map root...");
        
        // Create a simple root node for Qatar
        const rootNode = new MapPlaneNode(null, this, -1, 10, 812, 394);
        
        if (this.root !== null) {
            this.remove(this.root);
            this.root = null;
        }
        
        this.root = rootNode;
        
        if (this.root !== null) {
            // Scale up the plane so it's visible
            this.root.scale.set(1000000, 1000000, 1000000);
            
            this.geometry = this.root.geometry;
            this.root.mapView = this;
            this.add(this.root);
            
            console.log("✅ Root node added to MapView");
        }
    }
    
    setProvider(provider) {
        if (provider !== this.provider) {
            this.provider = provider;
            console.log("🔄 Provider updated");
        }
    }
    
    raycast(raycaster, intersects) {
        return false;
    }
}

// Simplified MapBoxProvider with better error handling
class MapBoxProvider {
    constructor(apiToken = '', id = '', mode = 100, format = 'png', useHDPI = false, version = 'v4') {
        this.apiToken = apiToken;
        this.format = format;
        this.useHDPI = useHDPI;
        this.mode = mode;
        this.mapId = id;
        this.style = id;
        this.version = version;
        this.maxZoom = 18;
        this.minZoom = 0;
        
        console.log("🗺️ MapBoxProvider created with token:", apiToken.substring(0, 20) + "...");
    }
    
    fetchTile(zoom, x, y) {
        const url = `https://api.mapbox.com/styles/v1/${this.style}/tiles/${zoom}/${x}/${y}?access_token=${this.apiToken}`;
        console.log(`📡 Fetching tile: ${url}`);
        
        return new Promise((resolve, reject) => {
            const image = document.createElement('img');
            
            image.onload = function () {
                console.log(`✅ Tile loaded: ${zoom}/${x}/${y}`);
                resolve(image);
            };
            
            image.onerror = function () {
                console.error(`❌ Failed to load tile: ${zoom}/${x}/${y}`);
                console.error("URL:", url);
                reject();
            };
            
            image.crossOrigin = 'Anonymous';
            image.src = url;
        });
    }
}

// Utility functions
class UnitsUtils {
    static datumsToSpherical(latitude, longitude) {
        const EARTH_ORIGIN = 20037508.342789244;
        const x = longitude * EARTH_ORIGIN / 180.0;
        let y = Math.log(Math.tan((90 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
        y = y * EARTH_ORIGIN / 180.0;
        return new three.Vector2(x, y);
    }
}

// Export for global use
window.Geo = {
    MapView: MapView,
    MapBoxProvider: MapBoxProvider,
    UnitsUtils: UnitsUtils
};
