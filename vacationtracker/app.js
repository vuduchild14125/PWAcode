//create constants for the form and the form controls. 
const newVacationFormel = document.getElementsByTagName("form")[0]; 
const startDateInputEl = document.getElementById("start-date"); 
const endDateInputEl = document.getElementById("end-date"); 
const pastVacationContainer = document.getElementById("past-vacations"); 


//listen for form submissions
newVacationFormel.addEventListener("submit", (event)=>{
    //prevent from submitting to the server
    //handling everything on the client-side
    event.preventDefault(); 

    //get the start and end dates from the form
    const startDate = startDateInputEl.value;
    const endDate = endDateInputEl.value; 

    //check if dates are invalid
    if (checkDatesInvalid(startDate, endDate)) {
        return; //return if invalid
    }

    //store the new vacation in our client-side storage.
    storeNewVacation(startDate, endDate); 

    //refresh the UI 
    renderPastVacations(); 

    //reset the form 
    newVacationFormel.reset(); 

}); //submit listener

function checkDatesInvalid(startDate, endDate) { 
    if(!startDate || !endDate || startDate > endDate) {
        //probably should do more robust error messaging, etc
        newVacationFormel.reset(); 
        return true; 


    } else {
        return false; 
    }
} //check dates

//add the storage key as an app-wide constant
const STORAGE_KEY = "vacation-tracker"; 

function storeNewVacation(startDate, endDate) {

    //get existing vacations from storage
    const vacations = getStoredVacations(); 

    //add the new vacation to the end of the arragy of vacation objects
    vacations.push({startDate, endDate}); 

    //sort the array - newest to oldest

    vacations.sort((a, b)=>{
        return new Date(b.startDate) - new Date(a.startDate); 
    }); 

    //store the updated list 
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vacations)); 

}//store new vacation

function getStoredVacations() {
    //get the string of vacations from local storage
    const data = window.localStorage.getItem(STORAGE_KEY); 

    //if no vacations are stored, default to empty array 
    const vacations = data ? JSON.parse(data) : [];

    return vacations; 
}

function renderPastVacations() {
    //get vacations
    const vacations = getStoredVacations(); 

    //exit if no vacations
    if(vacations.length === 0) {
        return; 
    }

    //create the list of past vacations
    pastVacationContainer.innerHTML = ""; 
    const pastVacationHeader = document.createElement("h2"); 
    pastVacationContainer.textContent = "Past Vacations"; 

    const pastVacationList = document.createElement("ul"); 

    //loop over all the vacations and render them 
    vacations.forEach((vacation)=>{
        const vacationEl = document.createElement("li"); 
        vacationEl.textContent = `From ${formatDate(vacation.startDate)} tO 
            ${formatDate(vacation.endDate)}`; 
        pastVacationList.appendChild(vacationEl); 
    });


    pastVacationContainer.appendChild(pastVacationHeader); 
    pastVacationContainer.appendChild(pastVacationList); 

}//renderPastVacations

function formatDate(dateString) { 
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {timeZone: "UTC"}); 
}//formatDate

//start the app by rendering past vacations if any 
renderPastVacations(); 


//register the service worker
if ("serviceWorker" in navigator) {
    //browser supports it
    navigator.serviceWorker.register("sw.js").then(
        (registration) => {
            console.log("Service worker registered with scope: ", registration.scope);
        },
        (error) => {
            console.error(`Service worker registration failed: ${error}`); 
        }
    );
} else {
    console.error("Service worker are not supported"); 
}

//listen for messages from the service worker 
navigator.serviceWorker.addEventListener("message", (event) => {
    console.log("Received message from service worker: ", event.data);


    //handle the different message types
    if (event.data.type === "update") {
        console.log("update received: ", event.data.data); 
        //update the UI if needed or perform some other action
    }
});

//function to send message to the service worker
function sendMessageToSW(message) {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message); 
    }
}

//create a broadcast channel - name needs to match the name in the SW
const channel = new BroadcastChannel("pwa_channel");

//listen for messages
channel.onmessage = (event)=>{
    console.log("Received message from SW: ", event.data);
    document.getElementById("messages")
        .insertAdjacentHTML("beforeend", `<p>Received ${event.data}</p>`);
};

document.getElementById("sendButton").addEventListener("click",()=>{
    const message = "Hello from PWA";
    sendMessageToSW({type: "action", data: "Button Clicked"}); 
    channel.postMessage(message); 
    console.log("Sent message from PWA:", message); 
}); 


//open or create the database
let db; 
const dbName = "SyncDatabase"; 
const request = indexedDB.open(dbName, 1); // 1 is the version

request.onerror = function (event) {
    console.log("Database error: " + event.target.error); 
};

request.onsuccess = function (event) {
    db = event.target.result; 
    console.log("Database opened successfully!"); 
};

//triggered with change in version or when db is created
request.onupgradeneeded = function (event) {
    db = event.target.result; 

    //create an object store for the db to store the data called pendingData
    const objectStore = db.createObjectStore("pendingData", {
        keyPath: "id", 
        autoincrement: true
    });
};

//in order to do anything with indexed db, you need to create a transaction
function addDataToIndexedDB(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["pendingData"], "readwrite");
        const objectStore = transaction.objectStore("pendingData");
        const request = objectStore.add({ data: data }); 

        request.onsuccess = function (event) {
            resolve();
        };

        request.onerror = function (event) {
            reject("Error storing data: " + event.target.error);
        };
    }); //promise
}//add data

//handle form submission 
document.getElementById("dataForm")
    .addEventListener("submit", function (event){
        event.preventDefault(); 

        const data = document.getElementById("dataInput").value;

        //We need to check if both the service worker and the SyncManager are available

        if("serviceWorker" in navigator && "SyncManager" in window) {

            addDataToIndexedDB(data) //add the data
                .then(()=>navigator.serviceWorker.ready) //wait for SW to be ready
                .then(function(registration){
                    //register a sync event
                    return registration.sync.register("send-data"); 
                })
                .then(function(){
                    //update the UI to indicate successful registration
                    document.getElementById("status").textContent = 
                        "Sync registered. Data will be sent when online."; 
                })
                .catch(function(error) {
                    console.error("Error: ", error)
                });

        }//both available
        else {
            //if both aren't available - try to send immediately
            sendData(data)
                .then((result)=>{
                    //update the UI
                    document.getElementById("status").textContent = result; 
                })
                .catch((error)=>{
                    document.getElementById("status").textContent = error.message;
                });
        }
    });

    //simulate sending the data 
    function sendData(data) {
        console.log("Attempting to send data: ", data); 
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.5) {
                    resolve("Data sent successfully"); 
                } else {
                    reject(new Error("Failed to send data")); 
                }
            }, 1000);
        });
    }