const VERSION = "v1";

//offline resources list
const APP_STATIC_RESOURCES = [
    "index.html", 
    "style.css", 
    "app.js", 
    "joketracker.json", 
    "../assets/assets/icons/icon-512x512.png"
];

const CACHE_NAME = `joke-tracker-${VERSION}`; 
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

//create a broadcast channel - name needs to match the name in the SW
const channel = new BroadcastChannel("jokes_channel");

//listen for messages
channel.onmessage = (event)=>{
    console.log("Received message from PWA in SW", event.data); 

    if (event.data === "fetch-jokes") {
        console.log("Fetching jokes!");
        fetchJokes(); 
    }
};

//SIMILAR TO WHAT TO DO DURING EXAM
function fetchJokes() {
    fetch(
        "https://v2.jokeapi.dev/joke/Programming?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=twopart&amount=5"
    )
    .then((response)=>response.json())//convert to JSON
    .then((data)=>{
        console.log("Got jokes: ", data); 
        return addDataToIndexedDB(data);
    })//store in database
    .then(()=>{channel.postMessage("data-updated")})//notify the PWA
    .catch((error)=>{
        console.error("Error fetching jokes: ", error); 
        channel.postMessage("fetch-error"); //optionally send message back
    });//for the error
} //fetchJokes

function addDataToIndexedDB(data) {
    return new Promise((resolve, reject)=>{

        const request = indexedDB.open("JokesDatabase", 1); 

        request.onerror = (event) => {
            reject("IndexedDB Error: " + event.target.error); 
        };

        request.onsuccess = (event) => {
            const db = event.target.result; 
            const transaction = db.transaction(["jokeData"], "readwrite");
            const objectStore = transaction.objectStore("jokeData"); 

            //Add each joke
            data.jokes.forEach((joke)=>{
                let myuuid = crypto.randomUUID(); 
                joke.id = myuuid; 
                console.log(joke); 
                objectStore.add(joke); 
            });
            transaction.oncomplete = () => resolve(); 
            transaction.onerror = (event) => 
                reject("Transaction error: " + event.target.error);  
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result; 
            db.createObjectStore("jokeData", {keyPath: "id"});
        };

    }); //promise
}

//may also want to do a periodic sync
self.addEventListener("periodicsync", (event) => {
    if (event.tag === "fetch-jokes") {
        event.waitUntil(fetchJokes()); 
    }
});