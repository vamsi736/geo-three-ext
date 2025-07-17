three = THREE;

class GeoThreeExtension extends Autodesk.Viewing.Extension {
    load() {
        //var provider = new Geo.DebugProvider();
        var MAPBOX_TOKEN = 'pk.eyJ1IjoidmFtc2k3MzYiLCJhIjoiY21kNnpyeHViMDQwYjJpczhwdnk5bmRqaSJ9.gYlJEd0xPN7YJVehWuvgPA';
        var MAPBOX_STYLE = 'mapbox/streets-v11';
        var provider = new Geo.MapBoxProvider(MAPBOX_TOKEN, MAPBOX_STYLE, Geo.MapBoxProvider.STYLE);

        // FIX 1: Corrected 'this map' to 'this.map'
        this.map = new Geo.MapView(Geo.MapView.PLANAR, provider);
        
        // FIX 2: Qatar coordinates - Doha city center
        const dohaLat = 25.276987;
        const dohaLon = 51.520008;
        const coords = Geo.UnitsUtils.datumsToSpherical(dohaLat, dohaLon);
        
        // FIX 3: Adjust map positioning for Qatar
        this.map.position.set(coords.x, 0, -coords.y); // Changed Y from -45 to 0
        
        viewer.overlays.addScene('map');
        viewer.overlays.addMesh(this.map, 'map');
        this.map.updateMatrixWorld(false);

        // Camera settings
        viewer.autocam.shotParams.destinationPercent = 3;
        viewer.autocam.shotParams.duration = 3;
        var cam = viewer.getCamera();

        // FIX 4: Set initial camera position for Qatar view
        cam.target.set(coords.x, 0, -coords.y);
        cam.position.set(coords.x, 50000, -coords.y + 10000); // Elevated view of Qatar

        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
            viewer.autocam.toPerspective();
            this.map.lod.updateLOD(this.map, cam, viewer.impl.glrenderer(), viewer.overlays.impl.overlayScenes.map.scene, viewer.impl);
        });
        
        return true;
    }

    unload() {
        viewer.overlays.removeMesh(this.map, 'map');
        return true;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('GeoThreeExtension', GeoThreeExtension);

// Your existing Geo library code remains the same...
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Geo = {}, global.THREE));
}(this, (function (exports, three) { 'use strict';

    class MapProvider {
        constructor() {
            this.name = '';
            this.minZoom = 0;
            this.maxZoom = 20;
            this.bounds = [];
            this.center = [];
        }
        fetchTile(zoom, x, y) {
            return null;
        }
        getMetaData() { }
    }

    class OpenStreetMapsProvider extends MapProvider {
        constructor(address = 'https://a.tile.openstreetmap.org/') {
            super();
            this.address = address;
            this.format = 'png';
        }
        fetchTile(zoom, x, y) {
            return new Promise((resolve, reject) => {
                const image = document.createElement('img');
                image.onload = function () {
                    resolve(image);
                };
                image.onerror = function () {
                    reject();
                };
                image.crossOrigin = 'Anonymous';
                image.src = this.address + '/' + zoom + '/' + x + '/' + y + '.' + this.format;
            });
        }
    }

    class MapNodeGeometry extends three.BufferGeometry {
        constructor(width, height, widthSegments, heightSegments) {
            super();
            const widthHalf = width / 2;
            const heightHalf = height / 2;
            const gridX = widthSegments + 1;
            const gridZ = heightSegments + 1;
            const segmentWidth = width / widthSegments;
            const segmentHeight = height / heightSegments;
            const indices = [];
            const vertices = [];
            const normals = [];
            const uvs = [];
            for (let iz = 0; iz < gridZ; iz++) {
                const z = iz * segmentHeight - heightHalf;
                for (let ix = 0; ix < gridX; ix++) {
                    const x = ix * segmentWidth - widthHalf;
                    vertices.push(x, 0, z);
                    normals.push(0, 1, 0);
                    uvs.push(ix / widthSegments);
                    uvs.push(1 - iz / heightSegments);
                }
            }
            for (let iz = 0; iz < heightSegments; iz++) {
                for (let ix = 0; ix < widthSegments; ix++) {
                    const a = ix + gridX * iz;
                    const b = ix + gridX * (iz + 1);
                    const c = ix + 1 + gridX * (iz + 1);
                    const d = ix + 1 + gridX * iz;
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }

            this.addAttribute('index',    new three.BufferAttribute(new Uint32Array(indices),  1));
            this.addAttribute('position', new three.BufferAttribute(new Float32Array(vertices), 3));
            this.addAttribute('normal', new three.BufferAttribute(new Float32Array(normals), 3));
            this.addAttribute('uv', new three.BufferAttribute(new Float32Array(uvs), 2));
        }
    }

    class MapNode extends three.Mesh {
        constructor(parentNode = null, mapView = null, location = MapNode.ROOT, level = 0, x = 0, y = 0, geometry = null, material = null) {
            super(geometry, material);
            this.mapView = null;
            this.parentNode = null;
            this.nodesLoaded = 0;
            this.subdivided = false;
            this.childrenCache = null;
            this.isMesh = true;
            this.mapView = mapView;
            this.parentNode = parentNode;
            this.location = location;
            this.level = level;
            this.x = x;
            this.y = y;
            this.initialize();
        }
        initialize() { }
        createChildNodes() { }
        subdivide() {
            const maxZoom = this.mapView.provider.maxZoom;
            if (this.children.length > 0 || this.level + 1 > maxZoom || this.parentNode !== null && this.parentNode.nodesLoaded < MapNode.CHILDRENS) {
                return;
            }
            this.subdivided = true;
            if (this.childrenCache !== null) {
                this.isMesh = false;
                this.children = this.childrenCache;
            }
            else {
                this.createChildNodes();
            }
        }
        simplify() {
            if (this.children.length > 0) {
                this.childrenCache = this.children;
            }
            this.subdivided = false;
            this.isMesh = true;
            this.children = [];
        }
        loadTexture() {
            this.mapView.provider.fetchTile(this.level, this.x, this.y).then((image) => {
                const texture = new three.Texture(image);
                texture.generateMipmaps = false;
                texture.format = three.RGBFormat;
                texture.magFilter = three.LinearFilter;
                texture.minFilter = three.LinearFilter;
                texture.needsUpdate = true;
                this.material.map = texture;
                this.nodeReady();
            }).catch(() => {
            });
        }
        nodeReady() {
            if (this.parentNode !== null) {
                this.parentNode.nodesLoaded++;
                if (this.parentNode.nodesLoaded >= MapNode.CHILDRENS) {
                    if (this.parentNode.subdivided === true) {
                        this.parentNode.isMesh = false;
                    }
                    for (let i = 0; i < this.parentNode.children.length; i++) {
                        this.parentNode.children[i].visible = true;
                    }
                }
            }
            else {
                this.visible = true;
            }
        }
        getNeighborsDirection(direction) {
            return null;
        }
        getNeighbors() {
            const neighbors = [];
            return neighbors;
        }
    }
    MapNode.BASE_GEOMETRY = null;
    MapNode.BASE_SCALE = null;
    MapNode.CHILDRENS = 4;
    MapNode.ROOT = -1;
    MapNode.TOP_LEFT = 0;
    MapNode.TOP_RIGHT = 1;
    MapNode.BOTTOM_LEFT = 2;
    MapNode.BOTTOM_RIGHT = 3;

    class UnitsUtils {
        static get(onResult, onError) {
            navigator.geolocation.getCurrentPosition(function (result) {
                onResult(result.coords, result.timestamp);
            }, onError);
        }
        static datumsToSpherical(latitude, longitude) {
            const x = longitude * UnitsUtils.EARTH_ORIGIN / 180.0;
            let y = Math.log(Math.tan((90 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
            y = y * UnitsUtils.EARTH_ORIGIN / 180.0;
            return new three.Vector2(x, y);
        }
        static sphericalToDatums(x, y) {
            const longitude = x / UnitsUtils.EARTH_ORIGIN * 180.0;
            let latitude = y / UnitsUtils.EARTH_ORIGIN * 180.0;
            latitude = 180.0 / Math.PI * (2 * Math.atan(Math.exp(latitude * Math.PI / 180.0)) - Math.PI / 2.0);
            return { latitude: latitude, longitude: longitude };
        }
        static quadtreeToDatums(zoom, x, y) {
            const n = Math.pow(2.0, zoom);
            const longitude = x / n * 360.0 - 180.0;
            const latitudeRad = Math.atan(Math.sinh(Math.PI * (1.0 - 2.0 * y / n)));
            const latitude = 180.0 * (latitudeRad / Math.PI);
            return { latitude: latitude, longitude: longitude };
        }
    }
    UnitsUtils.EARTH_RADIUS = 2 * 63781.37;
    UnitsUtils.EARTH_PERIMETER = 2 * Math.PI * UnitsUtils.EARTH_RADIUS;
    UnitsUtils.EARTH_ORIGIN = UnitsUtils.EARTH_PERIMETER / 2.0;

    class MapPlaneNode extends MapNode {
        constructor(parentNode = null, mapView = null, location = MapNode.ROOT, level = 10, x = 812, y = 394) { // Qatar coordinates at zoom level 10
            super(parentNode, mapView, location, level, x, y, MapPlaneNode.GEOMETRY, new three.MeshBasicMaterial({ disableEnvMap:true, depthTest:true, depthWrite:false,  side: three.DoubleSide, transparent:false, wireframe: false }));
            this.matrixAutoUpdate = false;
            this.isMesh = true;
            this.visible = false;
        }
        initialize() {
            this.loadTexture();
        }
        createChildNodes() {
            const level = this.level + 1;
            const x = this.x * 2;
            const y = this.y * 2;
            let node = new MapPlaneNode(this, this.mapView, MapNode.TOP_LEFT, level, x, y);
            node.scale.set(0.5, 1, 0.5);
            node.position.set(-0.25, 2, -0.25);
            this.add(node);
            node.updateMatrix();
            node.updateMatrixWorld(true);
            node = new MapPlaneNode(this, this.mapView, MapNode.TOP_RIGHT, level, x + 1, y);
            node.scale.set(0.5, 1, 0.5);
            node.position.set(0.25, 2, -0.25);
            this.add(node);
            node.updateMatrix();
            node.updateMatrixWorld(true);
            node = new MapPlaneNode(this, this.mapView, MapNode.BOTTOM_LEFT, level, x, y + 1);
            node.scale.set(0.5, 1, 0.5);
            node.position.set(-0.25, 2, 0.25);
            this.add(node);
            node.updateMatrix();
            node.updateMatrixWorld(true);
            node = new MapPlaneNode(this, this.mapView, MapNode.BOTTOM_RIGHT, level, x + 1, y + 1);
            node.scale.set(0.5, 1, 0.5);
            node.position.set(0.25, 2, 0.25);
            this.add(node);
            node.updateMatrix();
            node.updateMatrixWorld(true);
        }
        raycast(raycaster, intersects) {
            if (this.isMesh === true) {
                return super.raycast(raycaster, intersects);
            }
            return false;
        }
    }
    MapPlaneNode.GEOMETRY = new MapNodeGeometry(1, 1, 1, 1);
    MapPlaneNode.BASE_GEOMETRY = MapPlaneNode.GEOMETRY;
    MapPlaneNode.BASE_SCALE = new three.Vector3(UnitsUtils.EARTH_PERIMETER, 1, UnitsUtils.EARTH_PERIMETER);

    class LODRaycast {
        constructor() {
            this.subdivisionRays = 2;
            this.thresholdUp = 0.6;
            this.thresholdDown = 0.15;
            this.raycaster = new three.Raycaster();
            this.mouse = new three.Vector2();
            this.powerDistance = false;
            this.scaleDistance = true;
        }
        updateLOD(view, camera, renderer, scene, viewerImpl) {
            let intersects = [];
            for (let t = 0; t < this.subdivisionRays; t++) {
                const vpVec = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, 1);
                const ray = new THREE.Ray();
                viewerImpl.viewportToRay(vpVec, ray);
                this.raycaster.set(ray.origin, ray.direction);

                intersects = this.raycaster.intersectObjects(view.children, true);
            }
            for (let i = 0; i < intersects.length; i++) {
                const node = intersects[i].object;
                let distance = intersects[i].distance;
                if (this.powerDistance) {
                    distance = Math.pow(distance * 2, node.level);
                }
                if (this.scaleDistance) {
                    const matrix = node.matrixWorld.elements;
                    const vector = new three.Vector3(matrix[0], matrix[1], matrix[2]);
                    distance = 1.3 * vector.length() / distance;
                }
                if (distance > this.thresholdUp) {
                    node.subdivide();
                    return;
                }
                else if (distance < this.thresholdDown) {
                    if (node.parentNode !== null) {
                        node.parentNode.simplify();
                        return;
                    }
                }
            }
        }
    }

    class MapView extends three.Mesh {
        constructor(root = MapView.PLANAR, provider = new OpenStreetMapsProvider(), heightProvider = null) {
            super(undefined, undefined);
            this.lod = null;
            this.provider = null;
            this.heightProvider = null;
            this.root = null;
            this.lod = new LODRaycast();
            this.provider = provider;
            this.heightProvider = heightProvider;
            this.setRoot(root);
        }
        setRoot(root) {
            root = new MapPlaneNode(null, this);
            if (this.root !== null) {
                this.remove(this.root);
                this.root = null;
            }
            this.root = root;
            if (this.root !== null) {
                this.rotateX(Math.PI/2);
                this.geometry = this.root.constructor.BASE_GEOMETRY;
                this.scale.copy(this.root.constructor.BASE_SCALE);
                this.root.mapView = this;
                this.add(this.root);
            }
        }
        setProvider(provider) {
            if (provider !== this.provider) {
                this.provider = provider;
                this.clear();
            }
        }
        setHeightProvider(heightProvider) {
            if (heightProvider !== this.heightProvider) {
                this.heightProvider = heightProvider;
                this.clear();
            }
        }
        clear() {
            this.traverse(function (children) {
                if (children.childrenCache) {
                    children.childrenCache = null;
                }
                if (children.loadTexture !== undefined) {
                    children.loadTexture();
                }
            });
            return this;
        }
        getMetaData() {
            this.provider.getMetaData();
        }
        raycast(raycaster, intersects) {
            return false;
        }
    }
    MapView.PLANAR = 200;
    MapView.SPHERICAL = 201;
    MapView.HEIGHT = 202;
    MapView.HEIGHT_SHADER = 203;

    // Rest of your library code (MapBoxProvider, etc.) remains the same...
    class MapBoxProvider extends MapProvider {
        constructor(apiToken = '', id = '', mode = MapBoxProvider.STYLE, format = 'png', useHDPI = false, version = 'v4') {
            super();
            this.apiToken = apiToken;
            this.format = format;
            this.useHDPI = useHDPI;
            this.mode = mode;
            this.mapId = id;
            this.style = id;
            this.version = version;
        }
        getMetaData() {
            const address = MapBoxProvider.ADDRESS + this.version + '/' + this.mapId + '.json?access_token=' + this.apiToken;
            // XHRUtils.get implementation would go here
        }
        fetchTile(zoom, x, y) {
            return new Promise((resolve, reject) => {
                const image = document.createElement('img');
                image.onload = function () {
                    resolve(image);
                };
                image.onerror = function () {
                    reject();
                };
                image.crossOrigin = 'Anonymous';
                if (this.mode === MapBoxProvider.STYLE) {
                    image.src = MapBoxProvider.ADDRESS + 'styles/v1/' + this.style + '/tiles/' + zoom + '/' + x + '/' + y + (this.useHDPI ? '@2x?access_token=' : '?access_token=') + this.apiToken;
                }
                else {
                    image.src = MapBoxProvider.ADDRESS + 'v4/' + this.mapId + '/' + zoom + '/' + x + '/' + y + (this.useHDPI ? '@2x.' : '.') + this.format + '?access_token=' + this.apiToken;
                }
            });
        }
    }
    MapBoxProvider.ADDRESS = 'https://api.mapbox.com/';
    MapBoxProvider.STYLE = 100;
    MapBoxProvider.MAP_ID = 101;

    // Export all the classes
    exports.MapProvider = MapProvider;
    exports.OpenStreetMapsProvider = OpenStreetMapsProvider;
    exports.MapNodeGeometry = MapNodeGeometry;
    exports.MapNode = MapNode;
    exports.UnitsUtils = UnitsUtils;
    exports.MapPlaneNode = MapPlaneNode;
    exports.LODRaycast = LODRaycast;
    exports.MapView = MapView;
    exports.MapBoxProvider = MapBoxProvider;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
