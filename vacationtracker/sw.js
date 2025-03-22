const VERSION = "v4";

//offline resources list
const APP_STATIC_RESOURCES = [
    "index.html", 
    "style.css", 
    "app.js", 
    "vacationtracker.json", 
    "../assets/assets/icons/icon-512x512.png"
];

const CACHE_NAME = `vacation-tracker-${VERSION}`; 
let cache; 

//install event listener to retrieve and store the cached resources
self.addEventListener("install", (event)=>{
    event.waitUntil(
        (async ()=>{
            cache = await caches.open(CACHE_NAME); 
            cache.addAll(APP_STATIC_RESOURCES);
        })()
    );
});

//listen for activate event update cache if needed and delete the old cache
self.addEventListener("activate", (event)=>{
    event.waitUntil(
        (async ()=>{
            //get existing cache names
            const names = await caches.keys();

            //iterate through all the cache promises
            await Promise.all(
                names.map((name)=>{
                    if (name !== CACHE_NAME){
                        //delete the old cache
                        return caches.delete(name);

                    }
                })
            );//promise.all

            //enable the service worker to take control of clients in scope
            await clients.claim(); 
        })()
    );
});

//listen for fetch event and intercept it so we can work offline
self.addEventListener("fetch", (event)=>{
    event.respondWith (

        (async () => {
            const cache = await caches.open(CACHE_NAME);
            
            //try to get requested resource from the cache
            const cachedResponse = await cache.match(event.request); 
            if (cachedResponse) {
                return cachedResponse; 
            }


            //if not in cache try to fetch from the network 
            try {
                const networkResponse = await fetch(event.request); 
                //cache for future use
                cache.put(event.request, networkResponse.clone()); 

                return networkResponse; 
            } catch (error) {
                console.error("Fetch failed;  returning offline page instead.", error); 

                //if request is for a page, return index.html as a fallback
                if (event.request.mode === "navigate") {
                    return cache.match("/index.html"); 
                }

                //for other resources, you could return a default offline asset
                //or just let error propagate
                throw error; 

                
            }//catch
        })()

    );//respondWith
}); //fetch

// //send a message to the client (app.js)
// function sendMessageToPWA(message) {

//     self.clients.matchAll().then((clients)=>{
//         clients.forEach((client)=>{
//             client.postMessage(message); 
//         });
//     });

// }//send message

// //send a message every 10 seconds
// setInterval(()=>{
//     sendMessageToPWA({type:"update", data:"New data Available"});
// }, 10000); 

// //listen for message from the client (PWA) 
// self.addEventListener("message", (event)=>{
//     console.log("Service worker received message: ", event.data); 


//     //you can respond back if needed
//     event.source.postMessage({
//         type: "response",
//         data: "Message received by SW", 
//     });
// }); 

//create a broadcast channel - name needs to match the name in the SW
const channel = new BroadcastChannel("pwa_channel");

//listen for messages
channel.onmessage = (event)=>{
    console.log("Received message in Service Worker: ", event.data);
    
    //echo the message back
    channel.postMessage("Service Worker received:" + event.data);
};

//open or create the database
let db; 
const dbName = "SyncDatabase"; 
const request = indexedDB.open(dbName, 1); // 1 is the version

request.onerror = function (event) {
    console.log("Database error: " + event.target.error); 
};

request.onsuccess = function (event) {
    db = event.target.result; 
    console.log("Darabase opened successfully!"); 
};

//listen for sync event
self.addEventListener("sync", function(event) {
    if (event.tag === "send-data") {
        event.waitUntil(sendDataToServer()); 
    }
});

function sendDataToServer() {
    return getAllPendingData().then(function(dataList){
        return Promise.all(
            dataList.map(function (item) {
                //simulate sending the data
                return new Promise((resolve, reject)=>{
                    setTimeout(() => {
                        if (Math.random() > 0.1) {
                            //assume 90% success rate
                            console.log("Data Sent Successfully:", item.data);
                            resolve(item.id); 
                        } else {
                            console.log("Failed to send data:", item.data);
                            reject(new Error("Failed to send data"));
                        }
                    }, 1000)
                }).then(function() {
                    //if successful, remove the item from the database
                    return removeDataFromIndexedDB(item.id);
                });
            })
        );//Promise.all
    }); //getAllPendingData then 
}//sendDataToServer

function getAllPendingData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction.objectStore(["pendingData"], "readonly");
        const objectStore = transaction.objectStore("pendingData");
        const request = objectStore.getAll(); 

        request.onsuccess = function (event) {
            resolve(event.target.result); //return all the objects
        };

        request.onerror = function(event) {
            reject("Error fetching data: " + event.target.error);
        };
    });
}//getAllPendingData

function removeDataFromIndexedDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction.objectStore(["pendingData"], "readwrite");
        const objectStore = transaction.objectStore("pendingData");
        const request = objectStore.delete(id); 

        request.onsuccess = function (event) {
            resolve(); //return all the objects
        };

        request.onerror = function(event) {
            reject("Error removing data: " + event.target.error);
        };
    });
}//remove from db