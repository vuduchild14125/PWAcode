if ("serviceWorker" in navigator) {
    window.addEventListener("load", ()=>{
        navigator.serviceWorker.register("sw.js")
        .then((registration)=>{
            console.log("Service worker successfully registered: ", registration);
        })
        .catch((error) => {
            console.log("Service worker registration failed: ", error); 
        }); 
    });
}

let db; 
const dbName = "JokesDatabase"; 
const request = indexedDB.open(dbName, 1); 

request.onerror = function (event) {
    console.error("Database error:" + event.target.error); 
};

request.onsuccess = function (event) {
    db = event.target.result; 
    console.log("Database opened successfully!");
};

request.onupgradeneeded = function (event) {
    db = event.target.result; 
    const objectStore = db.createObjectStore("jokeData", {
        keyPath: "id",
    });
};

//set up broadcast channel 
const channel = new BroadcastChannel("jokes_channel"); 


//listen for messages
channel.onmessage = (event) => {
    console.log("Received message from SW in PWA", event.data); 

    if (event.data === "data-updated") {
        //update our UI 
        console.log("Data updated!");
        renderPastJokes(); 
    }
}; 

renderPastJokes(); 

document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.getElementById("sendButton"); 

    if (sendButton) {
        sendButton.addEventListener("click", requestJokes); 
    } else {
        console.error("sendButton not found :(");
    }
});

function getAllJokes() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName); 
        request.onerror = function (event) {
            reject(`Database error: ${event.target.error}`); 
        };
        
        request.onsuccess = function (event) {
            db = event.target.result; 
            const transaction = db.transaction("jokeData", "readonly");
            const objectStore = transaction.objectStore("jokeData");
            const objects = []; 
            objectStore.openCursor().onsuccess = (event) => {
                const cursor = event.target.result; 
                if (cursor) {
                    objects.push(cursor.value);
                    cursor.continue(); 
                } else {
                    //no more objects to iterate, resolve the promise
                    resolve(objects); 
                }
            }; //onsuccess
            transaction.oncomplete = () => {
                //db.close();
            };
        };
    }); //promise
} //getAllJokes

function renderPastJokes() {
    getAllJokes()
    .then((jokes) => {
        console.log("all objects: ", jokes); 
        if (jokes.length > 0) {
            const jokeList = document.getElementById("allJokes"); 
            //clear the list and re-render it
            jokeList.innerHTML = ""; 

            const pastJokesHeader = document.createElement("h2"); 
            pastJokesHeader.textContent = "Saved Jokes"; 

            const pastJokesList = document.createElement("ul"); 
            pastJokesList.id = "jokeList"; 

            jokes.forEach((joke) => {
                const jokeEl = document.createElement("li"); 
                jokeEl.innerHTML = `<div>
                    <span class="title">Setup:</span>${joke.setup}<br />
                    <span class="title">Delivery:</span>${joke.delivery}
                </div>`;
                const deleteButton = document.createElement("button"); 
                deleteButton.textContent = "Delete"; 
                deleteButton.classList.add("delete-btn"); 
                deleteButton.addEventListener("click", () => {
                    deleteJoke(joke.id)
                });
                jokeEl.appendChild(deleteButton); 
                pastJokesList.appendChild(jokeEl); 
            });
            jokeList.appendChild(pastJokesHeader); 
            jokeList.appendChild(pastJokesList); 
        }
    })
    .catch((error) => {
        console.error("Error retrieving objects: ", error); 
    });
} //renderPastJokes

function deleteJoke(id) {
    const transaction = db.transaction(["jokeData"], "readwrite"); 
    const objectStore = transaction.objectStore("jokeData"); 
    const request = objectStore.delete(id); 
    request.onsuccess = function (event) {
        console.log("Joke deleted successfully"); 
        renderPastJokes(); 
    };
    request.onerror = function (event) {
        console.log("Error deleting joke: ", event.target.error); 
    };
}//deleteJoke

function requestJokes() {
    channel.postMessage("fetch-jokes"); 
    console.log("Requested jokes from service worker"); 
}