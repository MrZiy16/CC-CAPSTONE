from flask import Flask, request, jsonify
from datetime import datetime
import tensorflow as tf
import numpy as np
import requests
import os

# Flask app
app = Flask(__name__)

# Public GCS model URL
PUBLIC_MODEL_URL = "https://storage.googleapis.com/model_schedmate/model_schedmate%20(1).keras"
LOCAL_MODEL_PATH = "model_schedmate.keras"

# Bobot
w_task = 0.5
w_subject = 0.5
w_deadline = 3

# Daftar mean values dan valid tasks/subjects
mean_values = {
    'ulangan': 3.991722, 'pts_pas': 4.533113, 'tugas': 3.597682, 
    'presentasi': 3.594371, 'proyek': 4.046358, 'ekstrakurikuler': 2.149007, 
    'organisasi': 2.498344, 'agama': 2.241722, 'pkn': 2.754967, 
    'olahraga': 1.394040, 'indonesia': 2.572848, 'inggris': 3.062914, 
    'mandarin': 3.390728, 'matematika': 3.662252, 'biologi': 3.470199, 
    'fisika': 3.764901, 'kimia': 3.913907, 'senbud': 2.483444, 
    'prakarya': 2.296358, 'sejarah': 3.468543, 'ekonomi': 3.160596, 
    'sosiologi': 2.544702, 'geografi': 3.831126, 'komputer': 2.509934
}

valid_subjects = list(mean_values.keys())
valid_tasks = ['ulangan', 'pts_pas', 'tugas', 'presentasi', 'proyek', 'ekstrakurikuler', 'organisasi']

# Fungsi untuk menghitung skor prioritas
def calculate_urgency(task):
    urgency_values = {
        'ulangan': 3.991722, 'pts_pas': 4.533113, 'tugas': 3.597682, 
        'presentasi': 3.594371, 'proyek': 4.046358, 'ekstrakurikuler': 2.149007, 
        'organisasi': 2.498344
    }
    return urgency_values.get(task.lower(), 3.0)  # Default: 3.0

def calculate_difficulty(subject):
    return mean_values.get(subject.lower(), 3.5)  # Default: 3.5

def calculate_deadline_impact(deadline):
    time_left = (deadline - datetime.now()).total_seconds() / 3600  # Konversi ke jam
    if time_left <= 24:
        return 6
    elif time_left <= 48:
        return 4
    else:
        return 2

def calculate_priority(task, subject, deadline):
    urgency = calculate_urgency(task)
    difficulty = calculate_difficulty(subject)
    deadline_impact = calculate_deadline_impact(deadline)
    priority_score = w_task * urgency + w_subject * difficulty + w_deadline * deadline_impact
    return urgency, difficulty, deadline_impact, priority_score

# Fungsi untuk mengunduh model dari URL publik
def download_model_if_not_exists(url, local_path):
    if not os.path.exists(local_path):
        print(f"Downloading model from {url}...")
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Model downloaded to {local_path}")
        else:
            raise Exception(f"Failed to download model. Status code: {response.status_code}")

# Unduh model jika belum ada secara lokal
download_model_if_not_exists(PUBLIC_MODEL_URL, LOCAL_MODEL_PATH)

# Load model
model = tf.keras.models.load_model(LOCAL_MODEL_PATH)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Ambil data input
        data = request.json
        task = data.get('task', '').strip().lower()
        subject = data.get('subject', '').strip().lower()
        deadline_str = data.get('deadline', '').strip()

        # Validasi task
        if task not in valid_tasks:
            return jsonify({"error": f"Task '{task}' tidak valid. Valid tasks: {', '.join(valid_tasks)}"}), 400

        # Validasi subject
        if subject not in valid_subjects and task not in ['ekstrakurikuler', 'organisasi']:
            return jsonify({"error": f"Subject '{subject}' tidak valid. Valid subjects: {', '.join(valid_subjects)}"}), 400

        # Validasi deadline
        try:
            deadline = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M")
        except ValueError:
            return jsonify({"error": "Format deadline salah. Gunakan format: 'YYYY-MM-DD HH:MM'"}), 400

        # Hitung skor prioritas
        urgency, difficulty, deadline_impact, priority_score = calculate_priority(task, subject, deadline)

        # Gunakan model untuk prediksi (input disiapkan sesuai struktur model)
        input_vector = np.zeros((1, 25))  # Asumsikan model butuh 25 fitur
        input_vector[0, :3] = [urgency, difficulty, deadline_impact]
        prediction = model.predict(input_vector)

        # Kembalikan hasil
        return jsonify({
            "urgency": urgency,
            "difficulty": difficulty,
            "deadline_impact": deadline_impact,
            "priority_score": priority_score,
            "model_prediction": float(prediction[0][0])
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
