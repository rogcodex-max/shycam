/* =====================================================
   SHY WEBCAM
   Browser-based webcam + MediaPipe face detection
===================================================== */


/* =====================================================
   DOM ELEMENTS
===================================================== */

const video =
    document.getElementById("video");

const canvas =
    document.getElementById("outputCanvas");

const shutter =
    document.getElementById("shutter");

const startButton =
    document.getElementById("startButton");

const cameraFrame =
    document.getElementById("cameraFrame");

const cameraLed =
    document.querySelector(".camera-led");

const status =
    document.querySelector(".status");

const statusText =
    document.getElementById("statusText");

const eyeIndicator =
    document.getElementById("eyeIndicator");

const scareCountElement =
    document.getElementById("scareCount");

const anxietyValue =
    document.getElementById("anxietyValue");

const eyeStatus =
    document.getElementById("eyeStatus");

const anxietyText =
    document.getElementById("anxietyText");

const meterFill =
    document.getElementById("meterFill");

const panicOverlay =
    document.getElementById("panicOverlay");

const overlayCount =
    document.getElementById("overlayCount");

const overlayMessage =
    document.getElementById("overlayMessage");

const panicMessage =
    document.getElementById("panicMessage");

const recordElement =
    document.getElementById("record");


/* =====================================================
   GAME STATE
===================================================== */

let camera = null;

let running = false;

let lookingAtCamera = false;

let previousLookingState = false;

let scareCount = 0;

let anxiety = 0;

let lastPanicTime = 0;

let peekTimer = null;

let audioContext = null;


/* =====================================================
   SESSION RECORD
===================================================== */

let record =
    Number(
        localStorage.getItem(
            "shyWebcamRecord"
        )
    ) || 0;

recordElement.textContent = record;


/* =====================================================
   PANIC MESSAGES
===================================================== */

const panicMessages = [

    "എന്നെ നോക്കല്ലേ ചേട്ടാ 😭",

    "അയ്യോ വീണ്ടും വന്നോ ഇവൻ!",

   "Can you please look somewhere else?",

    "Bro... personal space 😭",

    "ചേട്ടാ... വേറെ പണിയൊന്നുമില്ലേ?",

    "I WASN'T READY FOR EYE CONTACT!",

    "WHY DID YOU LOOK DIRECTLY AT ME 💀",

    "ഹാ... എന്നെ വെറുതെ വിടൂ 😭",

    "I'M BLUSHING. PLEASE STOP.",

    "This is getting uncomfortable..."
];


/* =====================================================
   RANDOM MESSAGE
===================================================== */

function getRandomMessage() {

    return panicMessages[
        Math.floor(
            Math.random() *
            panicMessages.length
        )
    ];
}


/* =====================================================
   AUDIO
===================================================== */

function initAudio() {

    if (!audioContext) {

        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
    }

    if (
        audioContext.state ===
        "suspended"
    ) {

        audioContext.resume();
    }
}


/* =====================================================
   PANIC SOUND
   Uses Web Audio API.
   No external sound file required.
===================================================== */

function panicSound() {

    try {

        initAudio();

        const oscillator =
            audioContext.createOscillator();

        const gain =
            audioContext.createGain();

        oscillator.type = "sawtooth";

        const now =
            audioContext.currentTime;

        oscillator.frequency.setValueAtTime(
            600,
            now
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            180,
            now + 0.12
        );

        gain.gain.setValueAtTime(
            0.0001,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.12,
            now + 0.015
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.18
        );

        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );

        oscillator.start(now);

        oscillator.stop(
            now + 0.2
        );

    } catch (error) {

        console.log(
            "Audio unavailable."
        );
    }
}


/* =====================================================
   START WEBCAM
===================================================== */

async function startWebcam() {

    try {

        initAudio();

        statusText.textContent =
            "Requesting camera...";

        const stream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        width: {
                            ideal: 1280
                        },

                        height: {
                            ideal: 720
                        },

                        facingMode:
                            "user"
                    },

                    audio: false
                });


        video.srcObject =
            stream;


        await video.play();


        running = true;


        status.classList.add(
            "active"
        );

        statusText.textContent =
            "Webcam is awake";


        cameraLed.classList.add(
            "on"
        );


        startButton.innerHTML =
            "<span>😳</span> Webcam is awake";


        startButton.disabled = true;


        /*
         * Start MediaPipe camera.
         */

        camera =
            new Camera(
                video,
                {

                    onFrame:
                        async () => {

                            await faceMesh.send({
                                image: video
                            });
                        },

                    width: 1280,

                    height: 720
                }
            );


        camera.start();


    } catch (error) {

        console.error(error);


        statusText.textContent =
            "Camera permission denied";


        alert(
            "The webcam could not be started.\n\n" +
            "Please allow camera permission and try again."
        );
    }
}


/* =====================================================
   MEDIA PIPE FACE MESH
===================================================== */

const faceMesh =
    new FaceMesh({

        locateFile: (
            file
        ) => {

            return (
                "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/" +
                file
            );
        }

    });


faceMesh.setOptions({

    maxNumFaces: 1,

    refineLandmarks: true,

    minDetectionConfidence:
        0.5,

    minTrackingConfidence:
        0.5

});


/* =====================================================
   FACE DETECTION CALLBACK
===================================================== */

faceMesh.onResults(
    onFaceResults
);


/* =====================================================
   LANDMARK UTILITIES
===================================================== */

function distance(a, b) {

    const dx =
        a.x - b.x;

    const dy =
        a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* =====================================================
   DETERMINE WHETHER FACE IS LOOKING TOWARD CAMERA
===================================================== */

function detectEyeContact(
    landmarks
) {

    /*
     * MediaPipe provides 468+ face landmarks.
     *
     * We estimate:
     *
     * 1. Face orientation
     * 2. Eye openness
     * 3. Iris position
     *
     * This isn't medical-grade gaze tracking.
     * It is intentionally lightweight for a web game.
     */


    /* -----------------------------
       IMPORTANT FACE POINTS
    ----------------------------- */

    const nose =
        landmarks[1];

    const forehead =
        landmarks[10];

    const chin =
        landmarks[152];

    const leftEyeOuter =
        landmarks[33];

    const leftEyeInner =
        landmarks[133];

    const rightEyeInner =
        landmarks[362];

    const rightEyeOuter =
        landmarks[263];


    /* -----------------------------
       IRIS
    ----------------------------- */

    const leftIris =
        landmarks[468];

    const rightIris =
        landmarks[473];


    /* -----------------------------
       FACE TURN
    ----------------------------- */

    const faceWidth =
        distance(
            leftEyeOuter,
            rightEyeOuter
        );


    const noseCenter =
        (
            leftEyeOuter.x +
            rightEyeOuter.x
        ) / 2;


    const noseOffset =
        Math.abs(
            nose.x -
            noseCenter
        );


    const normalizedTurn =
        noseOffset /
        faceWidth;


    /*
     * If the nose is far from the
     * center of the eyes, the user
     * is probably turning their head.
     */

    const faceIsForward =
        normalizedTurn < 0.23;


    /* -----------------------------
       IRIS POSITION
    ----------------------------- */

    const leftEyeWidth =
        distance(
            leftEyeOuter,
            leftEyeInner
        );


    const rightEyeWidth =
        distance(
            rightEyeInner,
            rightEyeOuter
        );


    const leftIrisOffset =
        Math.abs(
            leftIris.x -
            (
                leftEyeOuter.x +
                leftEyeInner.x
            ) / 2
        );


    const rightIrisOffset =
        Math.abs(
            rightIris.x -
            (
                rightEyeInner.x +
                rightEyeOuter.x
            ) / 2
        );


    /*
     * Small iris offset means
     * eyes are roughly centered.
     */

    const leftCentered =
        leftIrisOffset <
        leftEyeWidth * 0.38;


    const rightCentered =
        rightIrisOffset <
        rightEyeWidth * 0.38;


    const eyesCentered =
        leftCentered &&
        rightCentered;


    /*
     * Final decision.
     */

    return (
        faceIsForward &&
        eyesCentered
    );
}


/* =====================================================
   FACE RESULTS
===================================================== */

function onFaceResults(
    results
) {

    if (!running) {
        return;
    }


    /*
     * No face detected.
     */

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        setLookingState(false);

        return;
    }


    const landmarks =
        results.multiFaceLandmarks[0];


    const eyeContact =
        detectEyeContact(
            landmarks
        );


    setLookingState(
        eyeContact
    );
}


/* =====================================================
   LOOKING STATE
===================================================== */

function setLookingState(
    state
) {

    lookingAtCamera = state;


    /*
     * User just started looking.
     */

    if (
        state &&
        !previousLookingState
    ) {

        triggerPanic();
    }


    /*
     * User stopped looking.
     */

    if (
        !state &&
        previousLookingState
    ) {

        startPeeking();
    }


    previousLookingState =
        state;


    updateEyeUI();
}


/* =====================================================
   UPDATE EYE UI
===================================================== */

function updateEyeUI() {

    if (lookingAtCamera) {

        eyeIndicator.classList.add(
            "active"
        );

        eyeStatus.textContent =
            "DIRECT";

    } else {

        eyeIndicator.classList.remove(
            "active"
        );

        eyeStatus.textContent =
            "Safe";
    }
}


/* =====================================================
   TRIGGER PANIC
===================================================== */

function triggerPanic() {

    const now =
        Date.now();


    /*
     * Prevent accidental
     * multiple triggers.
     */

    if (
        now -
        lastPanicTime <
        1000
    ) {

        return;
    }


    lastPanicTime =
        now;


    /* Increase score */

    scareCount++;


    /* Increase anxiety */

    anxiety =
        Math.min(
            100,
            anxiety + 12
        );


    /* Update UI */

    scareCountElement.textContent =
        scareCount;

    overlayCount.textContent =
        scareCount;


    anxietyValue.textContent =
        Math.round(anxiety);


    updateAnxietyUI();


    /* New message */

    const message =
        getRandomMessage();


    panicMessage.textContent =
        message;


    overlayMessage.textContent =
        message;


    /* Close shutter */

    shutter.classList.add(
        "closed"
    );


    /* Camera shake */

    cameraFrame.classList.add(
        "panic"
    );


    /* Full screen panic */

    panicOverlay.classList.add(
        "active"
    );


    /* Sound */

    panicSound();


    /* Update record */

    if (
        scareCount >
        record
    ) {

        record =
            scareCount;

        recordElement.textContent =
            record;

        localStorage.setItem(
            "shyWebcamRecord",
            record
        );
    }


    /*
     * Automatically remove
     * fullscreen panic after
     * a short time.
     *
     * Shutter stays closed until
     * user looks away.
     */

    setTimeout(
        () => {

            panicOverlay.classList.remove(
                "active"
            );

        },
        700
    );
}


/* =====================================================
   PEEKING
===================================================== */

function startPeeking() {

    clearTimeout(
        peekTimer
    );


    /*
     * Wait before peeking.
     */

    peekTimer =
        setTimeout(
            () => {

                /*
                 * Only open if the user
                 * is still looking away.
                 */

                if (
                    !lookingAtCamera
                ) {

                    shutter.classList.remove(
                        "closed"
                    );

                    cameraFrame.classList.remove(
                        "panic"
                    );
                }

            },
            850
        );
}


/* =====================================================
   ANXIETY UI
===================================================== */

function updateAnxietyUI() {

    const value =
        Math.round(anxiety);


    meterFill.style.width =
        value + "%";


    anxietyValue.textContent =
        value;


    if (value < 25) {

        anxietyText.textContent =
            "CALM";

    } else if (value < 50) {

        anxietyText.textContent =
            "NERVOUS";

    } else if (value < 75) {

        anxietyText.textContent =
            "PANICKING";

    } else {

        anxietyText.textContent =
            "ABSOLUTELY TERRIFIED";
    }
}


/* =====================================================
   ANXIETY DECAY
===================================================== */

setInterval(
    () => {

        if (!running) {
            return;
        }


        /*
         * Anxiety slowly decreases
         * while user isn't staring.
         */

        if (!lookingAtCamera) {

            anxiety =
                Math.max(
                    0,
                    anxiety - 1
                );

            updateAnxietyUI();
        }

    },
    1000
);


/* =====================================================
   START BUTTON
===================================================== */

startButton.addEventListener(
    "click",
    startWebcam
);


/* =====================================================
   PAGE VISIBILITY
===================================================== */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            /*
             * Nothing required.
             * Browser may pause camera.
             */

            return;
        }

    }
);


/* =====================================================
   CAMERA ERROR HANDLING
===================================================== */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            video.srcObject
        ) {

            video.srcObject
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }
    }
);


/* =====================================================
   INITIAL UI
===================================================== */

updateAnxietyUI();

console.log(
    "😳 Shy Webcam initialized."
);

console.log(
    "Please don't stare at it."
);
