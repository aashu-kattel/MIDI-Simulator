// Audio Context and Nodes
let audioContext;
let masterGain;
let reverbGain;
let activeOscillators = {};
let isRecording = false;
let recordedNotes = [];
let recordingStartTime = 0;
let playbackTimeout;

// Piano Configuration
const notes = [
    {note: 'C', freq: 261.63, key: 'a', type: 'white'},
    {note: 'C#', freq: 277.18, key: 'w', type: 'black'},
    {note: 'D', freq: 293.66, key: 's', type: 'white'},
    {note: 'D#', freq: 311.13, key: 'e', type: 'black'},
    {note: 'E', freq: 329.63, key: 'd', type: 'white'},
    {note: 'F', freq: 349.23, key: 'f', type: 'white'},
    {note: 'F#', freq: 369.99, key: 't', type: 'black'},
    {note: 'G', freq: 392.00, key: 'g', type: 'white'},
    {note: 'G#', freq: 415.30, key: 'y', type: 'black'},
    {note: 'A', freq: 440.00, key: 'h', type: 'white'},
    {note: 'A#', freq: 466.16, key: 'u', type: 'black'},
    {note: 'B', freq: 493.88, key: 'j', type: 'white'},
    {note: 'C', freq: 523.25, key: 'k', type: 'white'}
];

// Initialize Audio Context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    reverbGain = audioContext.createGain();
    
    masterGain.connect(reverbGain);
    reverbGain.connect(audioContext.destination);
    
    masterGain.gain.value = 0.5;
    reverbGain.gain.value = 0.3;
}

// Create Piano Keys
function createPiano() {
    const piano = document.getElementById('piano');
    
    notes.forEach((noteObj, index) => {
        const key = document.createElement('div');
        key.className = `key ${noteObj.type}-key`;
        key.dataset.note = noteObj.note;
        key.dataset.freq = noteObj.freq;
        key.dataset.key = noteObj.key;
        key.textContent = noteObj.key.toUpperCase();
        
        key.addEventListener('mousedown', () => playNote(noteObj.freq, key));
        key.addEventListener('mouseup', () => stopNote(noteObj.freq, key));
        key.addEventListener('mouseleave', () => stopNote(noteObj.freq, key));
        
        piano.appendChild(key);
    });
}

// Play Note
function playNote(frequency, keyElement) {
    if (!audioContext) initAudio();
    
    const octave = parseInt(document.getElementById('octave').value);
    const actualFreq = frequency * Math.pow(2, octave - 4);
    
    if (activeOscillators[actualFreq]) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = document.getElementById('instrument').value;
    oscillator.frequency.setValueAtTime(actualFreq, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    
    oscillator.start();
    activeOscillators[actualFreq] = {osc: oscillator, gain: gainNode};
    
    keyElement.classList.add('active');
    
    // Record note if recording
    if (isRecording) {
        recordedNotes.push({
            freq: actualFreq,
            time: audioContext.currentTime - recordingStartTime,
            type: 'start'
        });
    }
    
    // Update visualizer
    updateVisualizer();
}

// Stop Note
function stopNote(frequency, keyElement) {
    const octave = parseInt(document.getElementById('octave').value);
    const actualFreq = frequency * Math.pow(2, octave - 4);
    
    if (activeOscillators[actualFreq]) {
        const {osc, gain} = activeOscillators[actualFreq];
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        osc.stop(audioContext.currentTime + 0.1);
        delete activeOscillators[actualFreq];
        
        if (isRecording) {
            recordedNotes.push({
                freq: actualFreq,
                time: audioContext.currentTime - recordingStartTime,
                type: 'stop'
            });
        }
    }
    
    keyElement.classList.remove('active');
}

// Keyboard Event Handlers
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    
    const noteObj = notes.find(n => n.key === e.key.toLowerCase());
    if (noteObj) {
        const keyElement = document.querySelector(`[data-key="${noteObj.key}"]`);
        playNote(noteObj.freq, keyElement);
    }
});

document.addEventListener('keyup', (e) => {
    const noteObj = notes.find(n => n.key === e.key.toLowerCase());
    if (noteObj) {
        const keyElement = document.querySelector(`[data-key="${noteObj.key}"]`);
        stopNote(noteObj.freq, keyElement);
    }
});

// Control Event Listeners
document.getElementById('volume').addEventListener('input', (e) => {
    if (masterGain) {
        masterGain.gain.value = e.target.value / 100;
    }
});

document.getElementById('reverb').addEventListener('input', (e) => {
    if (reverbGain) {
        reverbGain.gain.value = e.target.value / 100;
    }
});

// Recording Controls
document.getElementById('recordBtn').addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

document.getElementById('playBtn').addEventListener('click', playRecording);
document.getElementById('stopBtn').addEventListener('click', stopPlayback);
document.getElementById('clearBtn').addEventListener('click', clearRecording);
document.getElementById('downloadBtn').addEventListener('click', downloadMIDI);

function startRecording() {
    if (!audioContext) initAudio();
    
    isRecording = true;
    recordedNotes = [];
    recordingStartTime = audioContext.currentTime;
    
    const btn = document.getElementById('recordBtn');
    btn.textContent = '⏹️ Stop Recording';
    btn.classList.add('recording');
}

function stopRecording() {
    isRecording = false;
    
    const btn = document.getElementById('recordBtn');
    btn.textContent = '🎙️ Record';
    btn.classList.remove('recording');
}

function playRecording() {
    if (recordedNotes.length === 0) return;
    
    recordedNotes.forEach(note => {
        setTimeout(() => {
            if (note.type === 'start') {
                const keyElement = document.querySelector(`[data-freq="${note.freq}"]`);
                if (keyElement) playNote(note.freq / Math.pow(2, parseInt(document.getElementById('octave').value) - 4), keyElement);
            } else {
                const keyElement = document.querySelector(`[data-freq="${note.freq}"]`);
                if (keyElement) stopNote(note.freq / Math.pow(2, parseInt(document.getElementById('octave').value) - 4), keyElement);
            }
        }, note.time * 1000);
    });
}

function stopPlayback() {
    // Stop all active oscillators
    Object.keys(activeOscillators).forEach(freq => {
        const {osc, gain} = activeOscillators[freq];
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.01);
        osc.stop(audioContext.currentTime + 0.01);
    });
    activeOscillators = {};
    
    // Remove active classes
    document.querySelectorAll('.key.active').forEach(key => {
        key.classList.remove('active');
    });
}

function clearRecording() {
    recordedNotes = [];
    stopPlayback();
}

function downloadMIDI() {
    if (recordedNotes.length === 0) {
        alert('No recording to download!');
        return;
    }
    
    // Simple MIDI-like format (JSON)
    const midiData = {
        tracks: [{
            notes: recordedNotes.map(note => ({
                frequency: note.freq,
                time: note.time,
                type: note.type
            }))
        }]
    };
    
    const blob = new Blob([JSON.stringify(midiData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'piano-recording.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Visualizer
function createVisualizer() {
    const visualizer = document.getElementById('visualizer');
    for (let i = 0; i < 32; i++) {
        const bar = document.createElement('div');
        bar.className = 'frequency-bar';
        bar.style.height = '0px';
        visualizer.appendChild(bar);
    }
}

function updateVisualizer() {
    const bars = document.querySelectorAll('.frequency-bar');
    const activeCount = Object.keys(activeOscillators).length;
    
    bars.forEach((bar, index) => {
        const height = Math.random() * activeCount * 15;
        bar.style.height = height + 'px';
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createPiano();
    createVisualizer();
    
    // Initial click to enable audio
    document.addEventListener('click', () => {
        if (!audioContext) initAudio();
    }, { once: true });
});