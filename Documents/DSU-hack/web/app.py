from fastapi import FastAPI, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
import uvicorn
from typing import Optional, List, Dict, Any
import requests
import json
import uuid
import pandas as pd
from pathlib import Path
import re
import numpy as np
from collections import defaultdict
import os
from typing import List, Dict, Tuple
import datetime
import aiohttp
# Create FastAPI app
app = FastAPI(title="CareChain API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "https://busy-onions-see.loca.lt",
    # Add any other origins your frontend might use
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Use specific origins instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MultiChain connection settings
RPC_USER = "multichainrpc"
RPC_PASSWORD = "DJwS8MKqFZTTe3nbdU3Co8fQxE6MhhTEqi2di3RYDcUx"
RPC_PORT = "4360"
RPC_HOST = "127.0.0.1"
CHAIN_NAME = "Health"
STREAM_NAME = "users"
DOCTOR_STREAM = "doctors"
RPC_URL = f"http://{RPC_USER}:{RPC_PASSWORD}@{RPC_HOST}:{RPC_PORT}"

# Add these global variables after your existing ones
DRUG_INTERACTIONS_FILE = "public/drug_interactions.csv"
interaction_df = None 
drug_lookup = None

# Create a medications database for search (or load from a real database)
MEDICATIONS_DB = [
    {
        "id": 1,
        "name": "Lisinopril",
        "common_dosages": ["5mg", "10mg", "20mg", "40mg"],
        "category": "ACE Inhibitor"
    },
    {
        "id": 2,
        "name": "Metformin",
        "common_dosages": ["500mg", "850mg", "1000mg"],
        "category": "Antidiabetic"
    },
    {
        "id": 3,
        "name": "Atorvastatin",
        "common_dosages": ["10mg", "20mg", "40mg", "80mg"],
        "category": "Statin"
    },
    {
        "id": 4,
        "name": "Aspirin",
        "common_dosages": ["81mg", "325mg"],
        "category": "NSAID"
    },
    {
        "id": 5,
        "name": "Ibuprofen",
        "common_dosages": ["200mg", "400mg", "600mg", "800mg"],
        "category": "NSAID"
    },
    {
        "id": 6,
        "name": "Amoxicillin",
        "common_dosages": ["250mg", "500mg", "875mg"],
        "category": "Antibiotic"
    },
    {
        "id": 7,
        "name": "Levothyroxine",
        "common_dosages": ["25mcg", "50mcg", "75mcg", "88mcg", "100mcg", "112mcg", "125mcg", "137mcg", "150mcg"],
        "category": "Thyroid"
    },
    {
        "id": 8,
        "name": "Simvastatin",
        "common_dosages": ["5mg", "10mg", "20mg", "40mg"],
        "category": "Statin"
    },
    {
        "id": 9,
        "name": "Omeprazole",
        "common_dosages": ["10mg", "20mg", "40mg"],
        "category": "PPI"
    },
    {
        "id": 10,
        "name": "Amlodipine",
        "common_dosages": ["2.5mg", "5mg", "10mg"],
        "category": "Calcium Channel Blocker"
    },
]

# Initialize the drug interaction database
@app.on_event("startup")
async def initialize_drug_data():
    global interaction_df, drug_lookup
    
    try:
        # Load the drug interactions dataset
        if os.path.exists(DRUG_INTERACTIONS_FILE):
            interaction_df = pd.read_csv(DRUG_INTERACTIONS_FILE)
            print(f"Loaded {len(interaction_df)} drug interactions")
            
            # Create a lookup dictionary for faster searches
            drug_lookup = defaultdict(list)
            for _, row in interaction_df.iterrows():
                drug1 = row['Drug 1'].lower()
                drug2 = row['Drug 2'].lower()
                drug_lookup[drug1].append((drug2, row['Interaction Description']))
                drug_lookup[drug2].append((drug1, row['Interaction Description']))
            
            print(f"Drug lookup table created with {len(drug_lookup)} entries")
        else:
            print(f"Warning: Drug interactions file not found at {DRUG_INTERACTIONS_FILE}")
            # Create a minimal mock dataset for testing
            interaction_df = pd.DataFrame({
                'Drug 1': ['Metformin', 'Aspirin', 'Warfarin'],
                'Drug 2': ['Lisinopril', 'Warfarin', 'Digoxin'],
                'Interaction Description': [
                    'Minimal risk of interaction. Monitor blood pressure.',
                    'Increased risk of bleeding when used together.',
                    'May increase risk of bleeding and alter Digoxin levels.'
                ]
            })
            
            # Create a lookup dictionary for the mock data
            drug_lookup = defaultdict(list)
            for _, row in interaction_df.iterrows():
                drug1 = row['Drug 1'].lower()
                drug2 = row['Drug 2'].lower()
                drug_lookup[drug1].append((drug2, row['Interaction Description']))
                drug_lookup[drug2].append((drug1, row['Interaction Description']))
    except Exception as e:
        print(f"Error initializing drug interaction database: {e}")
        interaction_df = None
        drug_lookup = None

# Pydantic models for request validation
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    age: str
    gender: str
    bloodGroup: str
    medicalIssues: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class DoctorSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    specialization: str
    licenseNumber: str
    hospital: str
    phone: str
    experience: Optional[str] = ""

class DoctorLogin(BaseModel):
    email: EmailStr
    password: str

class PrescriptionItem(BaseModel):
    medicine: str
    dosage: str
    frequency: str
    timing: Optional[str] = None
    days: str

class PrescriptionUpload(BaseModel):
    patient_id: str
    patient_email: str
    date: str
    items: List[PrescriptionItem]
    doctorAnalysis: Optional[str] = None  # Add doctor's diagnosis/analysis field
    doctor: Optional[str] = None  # Add doctor's name field

def multichain_request(method, params=None):
    """Make a request to the MultiChain API"""
    if params is None:
        params = []
    
    headers = {'content-type': 'application/json'}
    payload = {
        "method": method,
        "params": params,
        "id": 1,
        "chain_name": CHAIN_NAME
    }
    
    try:
        response = requests.post(RPC_URL, json=payload, headers=headers)
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MultiChain error: {str(e)}")

@app.post("/api/signup", status_code=201)
async def signup(user: UserSignup):
    """Register a new user and store details in MultiChain"""
    try:
        # Generate unique user ID
        user_id = str(uuid.uuid4())
        
        # Prepare data for blockchain
        # Note: In a production app, password should be hashed and not stored directly on blockchain
        blockchain_data = {
            "userId": user_id,
            "name": user.name,
            "email": user.email,
            "age": user.age,
            "gender": user.gender,
            "bloodGroup": user.bloodGroup,
            "medicalIssues": user.medicalIssues,
            "password": user.password  # In a real app, hash this password
        }
        
        # Convert to hex for MultiChain
        hex_data = json.dumps(blockchain_data).encode('utf-8').hex()
        
        # Create stream item with user email as the key
        result = multichain_request(
            "publish",
            [STREAM_NAME, user.email, hex_data]
        )
        
        if "result" in result:
            return {
                "success": True,
                "message": "User registered successfully",
                "userId": user_id
            }
        else:
            if "error" in result:
                raise HTTPException(status_code=500, detail=result["error"]["message"])
            else:
                raise HTTPException(status_code=500, detail="Unknown error occurred")
                
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
async def login(credentials: UserLogin):
    """Authenticate a user"""
    try:
        # Retrieve user data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, credentials.email]
        )
        
        if "result" in result and result["result"]:
            # Get the latest user data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            user_data_hex = latest_data["data"]
            if user_data_hex:
                user_data = json.loads(bytes.fromhex(user_data_hex).decode('utf-8'))
                
                # In a real app, you would hash the password and compare to stored hash
                if user_data["password"] == credentials.password:
                    return {
                        "success": True,
                        "message": "Login successful",
                        "userId": user_data["userId"],
                        "name": user_data["name"],
                        "email": user_data["email"]
                    }
                else:
                    raise HTTPException(status_code=401, detail="Invalid credentials")
            else:
                raise HTTPException(status_code=401, detail="Invalid user data")
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/doctor/signup", status_code=201)
async def doctor_signup(doctor: DoctorSignup):
    """Register a new doctor and store details in MultiChain"""
    try:
        # Generate unique doctor ID
        doctor_id = str(uuid.uuid4())
        
        # Ensure the doctors stream exists
        create_stream_result = multichain_request(
            "create", 
            ["stream", DOCTOR_STREAM, True]
        )
        print(f"Stream creation: {create_stream_result}")
        
        # Check if a doctor with this email already exists
        check_result = multichain_request(
            "liststreamkeyitems",
            [DOCTOR_STREAM, doctor.email]
        )
        
        if "result" in check_result and check_result["result"]:
            raise HTTPException(status_code=400, detail="A doctor with this email already exists")
        
        # Prepare data for blockchain
        blockchain_data = {
            "doctorId": doctor_id,
            "name": doctor.name,
            "email": doctor.email,
            "specialization": doctor.specialization,
            "licenseNumber": doctor.licenseNumber,
            "hospital": doctor.hospital,
            "phone": doctor.phone,
            "experience": doctor.experience,
            "password": doctor.password,  # In a real app, hash this password
            "role": "doctor"
        }
        
        # Convert to hex for MultiChain
        hex_data = json.dumps(blockchain_data).encode('utf-8').hex()
        
        # Create stream item with doctor email as the key
        result = multichain_request(
            "publish",
            [DOCTOR_STREAM, doctor.email, hex_data]
        )
        
        if "result" in result:
            # Subscribe to the doctors stream
            subscribe_result = multichain_request(
                "subscribe",
                [DOCTOR_STREAM]
            )
            
            return {
                "success": True,
                "message": "Doctor registered successfully",
                "doctorId": doctor_id
            }
        else:
            if "error" in result:
                raise HTTPException(status_code=500, detail=result["error"]["message"])
            else:
                raise HTTPException(status_code=500, detail="Unknown error occurred")
                
    except Exception as e:
        print(f"Doctor signup error: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/doctor/login")
async def doctor_login(credentials: DoctorLogin):
    """Authenticate a doctor using blockchain credentials"""
    try:
        # Retrieve doctor data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [DOCTOR_STREAM, credentials.email]  # Use DOCTOR_STREAM constant
        )
        
        if "result" in result and result["result"]:
            # Get the latest doctor data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            doctor_data_hex = latest_data["data"]
            if doctor_data_hex:
                doctor_data = json.loads(bytes.fromhex(doctor_data_hex).decode('utf-8'))
                
                # In a real app, you would hash the password and compare to stored hash
                if doctor_data["password"] == credentials.password:
                    return {
                        "success": True,
                        "message": "Login successful",
                        "doctorId": doctor_data["doctorId"],
                        "name": doctor_data["name"],
                        "email": doctor_data["email"],
                        "specialization": doctor_data["specialization"],
                        "hospital": doctor_data["hospital"],
                        "role": "doctor"
                    }
                else:
                    raise HTTPException(status_code=401, detail="Invalid credentials")
            else:
                raise HTTPException(status_code=401, detail="Invalid doctor data")
        else:
            raise HTTPException(status_code=404, detail="Doctor not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}")
async def get_user(email: str):
    try:
        result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, email]
        )
        
        if "result" in result and result["result"]:
            latest_data = result["result"][-1]
            user_data = json.loads(bytes.fromhex(latest_data["data"]).decode('utf-8'))
            
            # Make sure to include access_code in the returned data
            return user_data
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctor/{email}")
async def get_doctor_profile(email: str):
    """Get doctor profile data from blockchain"""
    try:
        # Retrieve doctor data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [DOCTOR_STREAM, email]
        )
        
        if "result" in result and result["result"]:
            # Get the latest doctor data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            doctor_data_hex = latest_data["data"]
            if doctor_data_hex:
                doctor_data = json.loads(bytes.fromhex(doctor_data_hex).decode('utf-8'))
                
                # Remove sensitive information
                if "password" in doctor_data:
                    del doctor_data["password"]
                    
                return doctor_data
            else:
                raise HTTPException(status_code=400, detail="Invalid doctor data")
        else:
            raise HTTPException(status_code=404, detail="Doctor not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctors")
async def get_all_doctors():
    """Get a list of all doctors"""
    try:
        # Retrieve all items from the doctors stream
        result = multichain_request(
            "liststreamitems",
            [DOCTOR_STREAM]
        )
        
        if "result" in result and result["result"]:
            doctors = []
            for item in result["result"]:
                if "data" in item and item["data"]:
                    doctor_data = json.loads(bytes.fromhex(item["data"]).decode('utf-8'))
                    
                    # Remove sensitive information
                    if "password" in doctor_data:
                        del doctor_data["password"]
                        
                    doctors.append(doctor_data)
            
            return {"doctors": doctors}
        else:
            return {"doctors": []}
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patients")
async def get_patients(doctor_email: str = None):
    """Get all patients from blockchain, optionally filtered by authorized doctor"""
    try:
        # Get all items from the users stream
        result = multichain_request(
            "liststreamitems", 
            [STREAM_NAME]
        )
        
        if "result" in result:
            patients = result["result"]
            
            # Group by patient email to find latest entries
            latest_patients = {}
            for patient in patients:
                try:
                    patient_data = json.loads(bytes.fromhex(patient["data"]).decode('utf-8'))
                    email = patient_data.get("email")
                    
                    if email:
                        # Only keep the patient with the highest blocktime (most recent)
                        if email not in latest_patients or patient["blocktime"] > latest_patients[email]["blocktime"]:
                            latest_patients[email] = patient
                except:
                    continue
                    
            # Get only the latest record for each patient
            unique_patients = list(latest_patients.values())
            
            # If doctor_email is provided, filter patients
            if doctor_email:
                filtered_patients = []
                for patient in unique_patients:
                    try:
                        patient_data = json.loads(bytes.fromhex(patient["data"]).decode('utf-8'))
                        if "authorized_doctors" in patient_data and doctor_email in patient_data["authorized_doctors"]:
                            filtered_patients.append(patient)
                    except:
                        continue
                return filtered_patients
            
            return unique_patients
        else:
            raise HTTPException(status_code=500, detail="Failed to retrieve patients")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status")
async def check_status():
    """Check if MultiChain is accessible"""
    try:
        result = multichain_request("getinfo")
        if "result" in result:
            return {
                "status": "connected",
                "chain": result["result"]["chainname"]
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Could not connect to MultiChain"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug")
async def debug_endpoint():
    """Test endpoint to verify API is working"""
    return {
        "status": "ok",
        "message": "API is working properly",
        "timestamp": str(uuid.uuid4())
    }

def generate_complementary_strand(dna_strand):
    """Generate the complementary DNA strand"""
    complement_dict = {'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C'}
    complementary_strand = ''
    
    for base in dna_strand:
        complementary_strand += complement_dict.get(base, base)
    
    return complementary_strand[::-1]

def check_huntingtin_sequence(sequence):
    """Check for Huntington's Disease genetic markers"""
    cleaned_sequence = sequence.upper().replace(" ", "")
    cag_counts = [len(match.group(0)) // 3 for match in re.finditer(r'(CAG)+', cleaned_sequence)]
    c_count = max(cag_counts, default=0)
    return 1 if c_count > 35 else 0

def check_sickle_cell_sequence(genetic_sequence):
    """Check for Sickle Cell Anemia genetic markers"""
    start_index = genetic_sequence.find("ATG")
    if start_index != -1:
        target_position = start_index + 14
        if len(genetic_sequence) > target_position:
            return 1 if genetic_sequence[target_position] == 'T' else 0
    return 0

def check_dmd_sequence(sequence):
    """Check for Muscular Dystrophy genetic markers"""
    cleaned_sequence = sequence.upper().replace(" ", "")
    for i in range(0, len(cleaned_sequence), 3):
        codon = cleaned_sequence[i:i+3]
        if codon in ["TGA", "TAG", "TAA"]:
            return 1
    return 0 if "---" not in cleaned_sequence else 1

def generate_punnett_square(parent1, parent2):
    """Generate Punnett square for genetic inheritance"""
    punnett_square = []
    for gene1 in parent1:
        for gene2 in parent2:
            punnett_square.append(gene1 + gene2)
    return punnett_square

class GeneticAnalysisRequest(BaseModel):
    disease: str
    father_sequence: str
    mother_sequence: str
    paternal_grandfather_sequence: str
    paternal_grandmother_sequence: str
    maternal_grandfather_sequence: str
    maternal_grandmother_sequence: str

@app.post("/api/analyze")
async def analyze_genetics(request_data: GeneticAnalysisRequest):
    """Analyze genetic sequences for disease markers"""
    try:
        print("\n=== Starting Genetic Analysis ===")
        data = request_data.dict()
        print(f"Received data for analysis: {data['disease']}")
        
        # Generate complementary strands
        print("\nGenerating complementary strands...")
        sequences = {}
        for key in [
            'father_sequence', 
            'mother_sequence', 
            'paternal_grandfather_sequence', 
            'paternal_grandmother_sequence', 
            'maternal_grandfather_sequence', 
            'maternal_grandmother_sequence'
        ]:
            sequence = data[key]
            complement = generate_complementary_strand(sequence)
            sequences[key] = sequence
            sequences[f"{key}_complement"] = complement
            print(f"Generated complement for {key}: {complement[:10]}...")

        # Process based on disease type
        disease = data['disease']
        print(f"\nProcessing disease type: {disease}")
        if disease == "Huntington's Disease":
            check_function = check_huntingtin_sequence
            print("Using Huntington's Disease check function")
        elif disease == "Sickle Cell Anemia":
            check_function = check_sickle_cell_sequence
            print("Using Sickle Cell Anemia check function")
        elif disease == "Muscular Dystrophy":
            check_function = check_dmd_sequence
            print("Using Muscular Dystrophy check function")
        else:
            print(f"ERROR: Invalid disease type - {disease}")
            raise HTTPException(status_code=400, detail='Invalid disease type')

        # Generate results
        print("\nAnalyzing sequences...")
        results = []
        for key, sequence in sequences.items():
            result = str(check_function(sequence))
            results.append(result)
            print(f"Analysis result for {key}: {result}")
        results = ''.join(results)
        print(f"Combined results string: {results}")

        # Generate Punnett squares
        print("\nGenerating Punnett squares...")
        father_genotype = results[:2]
        mother_genotype = results[2:4]
        paternal_grandfather_genotype = results[4:6]
        paternal_grandmother_genotype = results[6:8]
        maternal_grandfather_genotype = results[8:10]
        maternal_grandmother_genotype = results[10:]

        print(f"Father genotype: {father_genotype}")
        print(f"Mother genotype: {mother_genotype}")
        print(f"Paternal grandparents genotypes: {paternal_grandfather_genotype}, {paternal_grandmother_genotype}")
        print(f"Maternal grandparents genotypes: {maternal_grandfather_genotype}, {maternal_grandmother_genotype}")

        punnett_squares = {
            'father_mother': generate_punnett_square(father_genotype, mother_genotype),
            'paternal_grandparents': generate_punnett_square(paternal_grandfather_genotype, paternal_grandmother_genotype),
            'maternal_grandparents': generate_punnett_square(maternal_grandfather_genotype, maternal_grandmother_genotype)
        }
        print("Punnett squares generated successfully")

        # Store results in CSV
        print("\nStoring results in CSV...")
        df = pd.DataFrame({
            "Disease": [disease],
            **{k: [v] for k, v in sequences.items()},
            "Results": [results]
        })

        csv_file_path = "genetic_data.csv"
        if Path(csv_file_path).is_file():
            print("Appending to existing CSV file")
            existing_df = pd.read_csv(csv_file_path)
            df = pd.concat([existing_df, df], ignore_index=True)
        df.to_csv(csv_file_path, index=False)
        print("Data saved successfully")

        print("\n=== Analysis Complete ===")
        return {
            'disease': disease,
            'sequences': sequences,
            'results': results,
            'punnett_squares': punnett_squares
        }

    except Exception as e:
        print(f"\nERROR: An exception occurred - {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/prescriptions/{email}")
async def get_prescriptions(email: str):
    """Get all prescriptions for a user from their profile data"""
    try:
        # Retrieve user data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, email]
        )
        
        if "result" in result and result["result"]:
            # Get the latest user data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            user_data_hex = latest_data["data"]
            if user_data_hex:
                user_data = json.loads(bytes.fromhex(user_data_hex).decode('utf-8'))
                
                # Get prescriptions list or empty list if not present
                prescriptions = user_data.get("prescriptions", [])
                
                # Extract all medications for drug interaction checking
                medications = set()
                for prescription in prescriptions:
                    if "medication" in prescription:
                        medications.add(prescription["medication"])
                    
                    # If there's prescription text, extract medications from it
                    if "prescriptionText" in prescription:
                        extracted_meds = extract_medications_from_text(prescription["prescriptionText"])
                        for med in extracted_meds:
                            medications.add(med)
                
                # Check for interactions between medications
                interactions = find_drug_interactions(list(medications))
                
                return {
                    "prescriptions": prescriptions,
                    "interactions": interactions,
                    "medications": list(medications)
                }
            else:
                raise HTTPException(status_code=401, detail="Invalid user data")
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/prescription-pdf/{ipfs_hash}")
async def get_prescription_pdf(ipfs_hash: str):
    """Get a prescription PDF URL by IPFS hash"""
    try:
        ipfs_url = f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
        return {"success": True, "ipfsUrl": ipfs_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving IPFS URL: {str(e)}")

def extract_medications_from_text(text: str) -> List[str]:
    """Extract medication names from text using rule-based patterns"""
    # Common medicine name patterns
    medicine_patterns = [
        r'(?:Tab|Tablet|Cap|Capsule|Inj|Injection|Syp|Syrup|Sol|Solution)\s+([A-Za-z0-9\-]+)',
        r'([A-Za-z0-9\-]+)\s+(?:\d+\.?\d*)\s*(?:mg|mcg|g|ml)',
        r'([A-Za-z0-9\-]+)\s+(?:once|twice|three times|daily|bd|tid|qid)',
    ]
    
    medicines = set()
    for pattern in medicine_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            medicine = match.group(1).strip().title()
            if len(medicine) > 2:  # Avoid very short matches
                medicines.add(medicine)
    
    # Check the text for known drugs in our database
    if drug_lookup:
        for drug_name in drug_lookup.keys():
            # Check for the drug name as a whole word
            if re.search(r'\b' + re.escape(drug_name) + r'\b', text, re.IGNORECASE):
                medicines.add(drug_name.title())
    
    return list(medicines)

def find_drug_interactions(medications: List[str]) -> List[Dict]:
    """Find interactions between the provided medications using the database"""
    if not drug_lookup or not medications:
        return []
    
    interactions = []
    
    # Convert all medication names to lowercase for comparison
    meds_lower = [med.lower() for med in medications]
    
    # Check each pair of medications for interactions
    for i, drug1 in enumerate(meds_lower):
        for drug2 in meds_lower[i+1:]:
            # Skip if the same drug
            if drug1 == drug2:
                continue
                
            # Check if there's an interaction in either direction
            found_interaction = False
            
            # Check if drug1 has interactions with drug2
            for interaction_drug, description in drug_lookup.get(drug1, []):
                if interaction_drug.lower() == drug2.lower():
                    # Determine severity based on description text
                    severity = "Low"
                    if "high" in description.lower() or "severe" in description.lower():
                        severity = "High"
                    elif "moderate" in description.lower() or "significant" in description.lower():
                        severity = "Medium"
                    
                    # Extract recommendation if available
                    recommendation = ""
                    if "." in description:
                        parts = description.split(".", 1)
                        if len(parts) > 1:
                            recommendation = parts[1].strip()
                    
                    interactions.append({
                        "drugs": [drug1.title(), drug2.title()],
                        "severity": severity,
                        "description": description,
                        "recommendation": recommendation
                    })
                    found_interaction = True
                    break
            
            # If no interaction was found in the first direction, search in reverse
            if not found_interaction:
                for interaction_drug, description in drug_lookup.get(drug2, []):
                    if interaction_drug.lower() == drug1.lower():
                        # Determine severity based on description text
                        severity = "Low"
                        if "high" in description.lower() or "severe" in description.lower():
                            severity = "High"
                        elif "moderate" in description.lower() or "significant" in description.lower():
                            severity = "Medium"
                        
                        # Extract recommendation if available
                        recommendation = ""
                        if "." in description:
                            parts = description.split(".", 1)
                            if len(parts) > 1:
                                recommendation = parts[1].strip()
                        
                        interactions.append({
                            "drugs": [drug1.title(), drug2.title()],
                            "severity": severity,
                            "description": description,
                            "recommendation": recommendation
                        })
                        break
    
    return interactions

def analyze_text_like_llm(text: str) -> str:
    """Generate an LLM-like explanation about drug interactions - no real LLM used"""
    # Extract medications
    medications = extract_medications_from_text(text)
    if not medications:
        return "No medications detected in the provided text."
    
    # Find interactions
    interactions = find_drug_interactions(medications)
    if not interactions:
        return f"No significant interactions found between the detected medications: {', '.join(medications)}."
    
    # Generate a summary
    summary = f"Analysis of medication interactions:\n\n"
    summary += f"Detected medications: {', '.join(medications)}\n\n"
    summary += f"Potential interactions ({len(interactions)}):\n"
    
    for i, interaction in enumerate(interactions, 1):
        summary += f"{i}. {interaction['drugs'][0]} + {interaction['drugs'][1]}\n"
        summary += f"   Severity: {interaction['severity']}\n"
        summary += f"   {interaction['description']}\n"
        if interaction['recommendation']:
            summary += f"   Recommendation: {interaction['recommendation']}\n"
        summary += "\n"
    
    return summary

@app.get("/api/drug-interactions/{patient_username}")
async def get_drug_interactions(patient_username: str):
    """Analyze drug interactions for a patient's existing prescriptions"""
    try:
        # Extract just the username part (before the @)
        if '@' in patient_username:
            email_safe = patient_username.split('@')[0]  # Get username part before @
        else:
            email_safe = patient_username  # Already just the username
            
        print(f"Searching for medications for patient: {email_safe}")
        
        # Use username directly as the prescription stream name
        prescription_stream = f"{email_safe}"
        
        # Get all prescription items
        stream_exists = multichain_request(
            "liststreams",
            [prescription_stream]
        )
        
        if "result" not in stream_exists or not stream_exists["result"]:
            print(f"Stream {prescription_stream} not found, returning empty array")
            return {"interactions": [], "medicines": []}
        
        # Get prescription items
        items = multichain_request(
            "liststreamitems",
            [prescription_stream]
        )
        
        if "result" not in items:
            return {"interactions": [], "medicines": []}
        
        # Extract medicines from prescriptions
        medicines = set()
        for item in items["result"]:
            if "data" in item and item["data"]:
                try:
                    prescription = json.loads(bytes.fromhex(item["data"]).decode('utf-8'))
                    if "medication" in prescription:
                        medicines.add(prescription["medication"].strip())
                    # Also check if there's a text-based prescription field
                    if "prescriptionText" in prescription:
                        extracted_meds = extract_medications_from_text(prescription["prescriptionText"])
                        for med in extracted_meds:
                            medicines.add(med)
                except Exception as e:
                    print(f"Error processing prescription: {str(e)}")
                    continue
        
        medicines = list(medicines)
        print(f"Found medications for {patient_username}: {medicines}")
        
        # Check for interactions between medicines
        interaction_results = find_drug_interactions(medicines)
        
        # If we have real interactions, add explanations
        if interaction_results:
            for result in interaction_results:
                if not "explanation" in result or not result["explanation"]:
                    # Generate an explanation based on the description
                    drug1 = result["drugs"][0]
                    drug2 = result["drugs"][1]
                    severity = result["severity"]
                    description = result["description"]
                    
                    explanation = f"The combination of {drug1} and {drug2} presents a {severity.lower()}"
                    explanation += f" risk interaction. {description}"
                    
                    if "recommendation" in result and result["recommendation"]:
                        explanation += f" {result['recommendation']}"
                    
                    result["explanation"] = explanation
        
        # For demo purposes, add a sample interaction if none found and we have 2+ medications
        if not interaction_results and len(medicines) >= 2:
            interaction_results.append({
                "drugs": [medicines[0], medicines[1]],
                "severity": "Low",
                "description": "Potential interaction detected by the system.",
                "recommendation": "Monitor for side effects and consult healthcare provider.",
                "explanation": f"The combination of {medicines[0]} and {medicines[1]} may have interactions. This is a demonstration result as no specific interaction was found in the database."
            })
        
        return {
            "success": True,
            "medicines": medicines,
            "interactions": interaction_results
        }
        
    except Exception as e:
        print(f"Error analyzing drug interactions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing drug interactions: {str(e)}")

@app.post("/api/analyze-prescription")
async def analyze_prescription(
    prescription_text: str = Form(...),
    patient_id: str = Form(...)
):
    """
    Extract medicines from prescription text and analyze interactions
    """
    try:
        print(f"Analyzing prescription for patient: {patient_id}")
        print(f"Prescription text: {prescription_text[:100]}...")
        
        # 1. Extract medicines from the text
        medicines = extract_medications_from_text(prescription_text)
        print(f"Extracted medicines: {medicines}")
        
        # 2. Find interactions between the medicines
        interaction_results = find_drug_interactions(medicines)
        
        # 3. Generate explanations for the interactions
        for result in interaction_results:
            if not "explanation" in result or not result["explanation"]:
                # Generate an explanation based on the description
                drug1 = result["drugs"][0]
                drug2 = result["drugs"][1]
                severity = result["severity"]
                description = result["description"]
                
                explanation = f"The combination of {drug1} and {drug2} presents a {severity.lower()}"
                explanation += f" risk interaction. {description}"
                
                if "recommendation" in result and result["recommendation"]:
                    explanation += f" {result['recommendation']}"
                
                result["explanation"] = explanation
        
        # 4. Generate an LLM-like analysis - this simulates what a real LLM would return
        analysis = analyze_text_like_llm(prescription_text)
        
        return {
            "success": True,
            "patient_id": patient_id,
            "medicines": medicines,
            "interactions": interaction_results,
            "prescription_text": prescription_text[:500] + "..." if len(prescription_text) > 500 else prescription_text,
            "analysis": analysis
        }
        
    except Exception as e:
        print(f"Error analyzing prescription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing prescription: {str(e)}")

@app.post("/api/user/{email}/prescription")
async def add_prescription_to_user(
    email: str,
    prescription: Dict[str, Any]
):
    """Add a prescription to a user's profile in the blockchain"""
    try:
        # Retrieve user data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, email]
        )
        
        if "result" in result and result["result"]:
            # Get the latest user data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            user_data_hex = latest_data["data"]
            if user_data_hex:
                user_data = json.loads(bytes.fromhex(user_data_hex).decode('utf-8'))
                
                # Add unique ID to prescription
                prescription["id"] = str(uuid.uuid4())
                prescription["timestamp"] = str(datetime.datetime.now())
                
                # Initialize prescriptions list if it doesn't exist
                if "prescriptions" not in user_data:
                    user_data["prescriptions"] = []
                
                # Add new prescription
                user_data["prescriptions"].append(prescription)
                
                # Convert to hex for MultiChain
                hex_data = json.dumps(user_data).encode('utf-8').hex()
                
                # Update stream item with user email as the key
                update_result = multichain_request(
                    "publish",
                    [STREAM_NAME, email, hex_data]
                )
                
                if "result" in update_result:
                    return {
                        "success": True,
                        "message": "Prescription added successfully",
                        "prescription_id": prescription["id"]
                    }
                else:
                    if "error" in update_result:
                        raise HTTPException(status_code=500, detail=update_result["error"]["message"])
                    else:
                        raise HTTPException(status_code=500, detail="Unknown error occurred")
            else:
                raise HTTPException(status_code=401, detail="Invalid user data")
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-prescription/{patient_id}")
async def upload_prescription(patient_id: str, data: PrescriptionUpload):
    """Upload a structured prescription to the blockchain"""
    try:
        # Validate the incoming data
        if not data or not data.items:
            raise HTTPException(status_code=400, detail="Missing prescription data or items")
            
        # For each medication in the prescription, create a stream entry
        prescription_stream = f"{patient_id}"
        
        # Generate unique ID for this prescription
        prescription_id = f"P{uuid.uuid4().hex[:8].upper()}"
        
        # Create prescription data with explicit type handling
        medications_data = []
        for item in data.items:
            if item:  # Check if item is not None
                try:
                    medications_data.append(item.dict())
                except Exception as e:
                    print(f"Error converting item to dict: {str(e)}")
                    medications_data.append({
                        "medicine": getattr(item, "medicine", "Unknown"),
                        "dosage": getattr(item, "dosage", ""),
                        "frequency": getattr(item, "frequency", ""),
                        "timing": getattr(item, "timing", ""),
                        "days": getattr(item, "days", "")
                    })
        
        prescription_data = {
            "id": prescription_id,
            "patient_id": patient_id,
            "email": data.patient_email,
            "date": data.date,
            "medications": medications_data,
            "doctorAnalysis": data.doctorAnalysis,  # Include doctor's analysis
            "doctor": data.doctor,  # Include doctor's name
            "created_at": datetime.datetime.now().isoformat()
        }
        
        # Convert to hex for MultiChain
        hex_data = json.dumps(prescription_data).encode('utf-8').hex()
        
        # FIXED CODE HERE: Check if stream exists with proper handling for None values
        stream_exists = multichain_request(
            "liststreams",
            [prescription_stream]
        )
        
        # Check if we need to create the stream
        need_create_stream = True
        
        if stream_exists and "result" in stream_exists and stream_exists["result"]:
            for stream in stream_exists["result"]:
                if stream and isinstance(stream, dict) and "name" in stream and stream["name"] == prescription_stream:
                    need_create_stream = False
                    break
        
        # Create the stream if needed
        if need_create_stream:
            print(f"Creating stream for patient {patient_id}")
            create_result = multichain_request(
                "create",
                ["stream", prescription_stream, True]
            )
            
            # Wait for stream creation to be confirmed
            import time
            time.sleep(2)
        
        # Subscribe to the stream with error handling
        try:
            multichain_request(
                "subscribe",
                [prescription_stream]
            )
        except Exception as e:
            # Might already be subscribed, which is fine
            print(f"Subscribe warning (can be ignored if already subscribed): {str(e)}")
        
        # Publish prescription to the stream
        result = multichain_request(
            "publish",
            [prescription_stream, prescription_id, hex_data]
        )
        
        if result and "result" in result:
            return {
                "success": True,
                "message": "Prescription uploaded successfully",
                "prescriptionId": prescription_id,
                "medications": medications_data
            }
        else:
            error_msg = "Unknown error"
            if result and "error" in result and isinstance(result["error"], dict) and "message" in result["error"]:
                error_msg = result["error"]["message"]
            raise HTTPException(status_code=500, detail=f"Publishing error: {error_msg}")
                
    except Exception as e:
        print(f"Error uploading prescription: {str(e)}")
        import traceback
        traceback.print_exc()  # Print the full error stack trace for debugging
        raise HTTPException(status_code=500, detail=f"Error uploading prescription: {str(e)}")

class PatientAddRequest(BaseModel):
    name: str
    email: EmailStr
    age: str
    gender: str
    bloodGroup: str
    medicalIssues: Optional[str] = ""
    doctor_email: str  # Email of the doctor adding this patient

@app.post("/api/doctor/add-patient", status_code=201)
async def add_patient(patient: PatientAddRequest):
    """Allow a doctor to add a new patient to the system"""
    try:
        # Verify the doctor exists first
        doctor_result = multichain_request(
            "liststreamkeyitems",
            [DOCTOR_STREAM, patient.doctor_email]
        )
        
        if "result" not in doctor_result or not doctor_result["result"]:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        # Generate unique user ID
        user_id = str(uuid.uuid4())
        
        # Generate a temporary password for the patient
        temp_password = f"Patient{user_id[:6]}"
        
        # Prepare data for blockchain
        blockchain_data = {
            "userId": user_id,
            "name": patient.name,
            "email": patient.email,
            "age": patient.age,
            "gender": patient.gender,
            "bloodGroup": patient.bloodGroup,
            "medicalIssues": patient.medicalIssues,
            "password": temp_password,  # Temporary password
            "added_by_doctor": patient.doctor_email,
            "prescriptions": []  # Initialize empty prescriptions list
        }
        
        # Convert to hex for MultiChain
        hex_data = json.dumps(blockchain_data).encode('utf-8').hex()
        
        # Create stream item with user email as the key
        result = multichain_request(
            "publish",
            [STREAM_NAME, patient.email, hex_data]
        )
        
        if "result" in result:
            return {
                "success": True,
                "message": "Patient added successfully",
                "userId": user_id,
                "temp_password": temp_password,
                "patient_email": patient.email
            }
        else:
            if "error" in result:
                raise HTTPException(status_code=500, detail=result["error"]["message"])
            else:
                raise HTTPException(status_code=500, detail="Unknown error occurred")
                
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

class PatientLinkRequest(BaseModel):
    patient_email: EmailStr
    access_code: str
    doctor_email: EmailStr

@app.post("/api/doctor/link-patient", status_code=200)
async def link_patient(request: PatientLinkRequest):
    """Link a doctor to an existing patient using access code"""
    try:
        # Verify the doctor exists
        doctor_result = multichain_request(
            "liststreamkeyitems",
            [DOCTOR_STREAM, request.doctor_email]
        )
        
        if "result" not in doctor_result or not doctor_result["result"]:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        # Find the patient in the blockchain
        patient_result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, request.patient_email]
        )
        
        if "result" not in patient_result or not patient_result["result"]:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get the latest patient data
        latest_patient = patient_result["result"][-1]
        
        # Decode patient data
        try:
            patient_data = json.loads(bytes.fromhex(latest_patient["data"]).decode('utf-8'))
        except:
            raise HTTPException(status_code=500, detail="Could not decode patient data")
        
        # Verify access code
        if "access_code" not in patient_data or patient_data["access_code"] != request.access_code:
            raise HTTPException(status_code=403, detail="Invalid access code")
        
        # Add doctor to patient's authorized doctors if not already present
        if "authorized_doctors" not in patient_data:
            patient_data["authorized_doctors"] = []
        
        if request.doctor_email not in patient_data["authorized_doctors"]:
            patient_data["authorized_doctors"].append(request.doctor_email)
            
            # Update the blockchain with the modified patient data
            hex_data = json.dumps(patient_data).encode('utf-8').hex()
            
            update_result = multichain_request(
                "publish",
                [STREAM_NAME, request.patient_email, hex_data]
            )
            
            if "result" not in update_result:
                raise HTTPException(status_code=500, detail="Failed to update patient data")
        
        # Return success response
        return {
            "success": True, 
            "message": "Successfully linked to patient", 
            "userId": patient_data["userId"],
            "name": patient_data["name"],
            "patient_email": request.patient_email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PatientUnlinkRequest(BaseModel):
    patient_email: EmailStr
    doctor_email: EmailStr

@app.post("/api/doctor/unlink-patient")
async def unlink_patient(request: PatientUnlinkRequest):
    """Remove doctor's access to a patient's records"""
    try:
        # Retrieve patient data from MultiChain
        patient_result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, request.patient_email]
        )
        
        if "result" not in patient_result or not patient_result["result"]:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Get the latest patient data
        latest_patient = patient_result["result"][-1]
        
        # Decode patient data
        try:
            patient_data = json.loads(bytes.fromhex(latest_patient["data"]).decode('utf-8'))
        except:
            raise HTTPException(status_code=500, detail="Could not decode patient data")
        
        # Initialize authorized_doctors if it doesn't exist
        if "authorized_doctors" not in patient_data:
            patient_data["authorized_doctors"] = []
            
        # Either the doctor is actually authorized, or we're adding them just to remove them
        # This ensures the removal will work regardless of prior state
        if request.doctor_email not in patient_data["authorized_doctors"]:
            patient_data["authorized_doctors"].append(request.doctor_email)
            
        # Now remove the doctor
        patient_data["authorized_doctors"].remove(request.doctor_email)
        
        # Update the blockchain with the modified patient data
        hex_data = json.dumps(patient_data).encode('utf-8').hex()
        
        update_result = multichain_request(
            "publish",
            [STREAM_NAME, request.patient_email, hex_data]
        )
        
        if "result" not in update_result:
            raise HTTPException(status_code=500, detail="Failed to update patient data")
        
        return {"success": True, "message": "Doctor unlinked from patient successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/{email}/generate-access-code")
async def generate_access_code(email: str):
    """Generate an access code for an existing user"""
    try:
        # Retrieve user data from MultiChain
        result = multichain_request(
            "liststreamkeyitems",
            [STREAM_NAME, email]
        )
        
        if "result" in result and result["result"]:
            # Get the latest user data
            latest_data = result["result"][-1]
            
            # Decode data from hex
            user_data_hex = latest_data["data"]
            if user_data_hex:
                user_data = json.loads(bytes.fromhex(user_data_hex).decode('utf-8'))
                
                # Generate new access code
                access_code = f"ACC{uuid.uuid4().hex[:6].upper()}"
                user_data["access_code"] = access_code
                
                # Convert to hex for MultiChain
                hex_data = json.dumps(user_data).encode('utf-8').hex()
                
                # Update stream item with user email as the key
                update_result = multichain_request(
                    "publish",
                    [STREAM_NAME, email, hex_data]
                )
                
                if "result" in update_result:
                    return {
                        "success": True,
                        "message": "Access code generated successfully",
                        "access_code": access_code
                    }
                else:
                    if "error" in update_result:
                        raise HTTPException(status_code=500, detail=update_result["error"]["message"])
                    else:
                        raise HTTPException(status_code=500, detail="Failed to update user data")
            else:
                raise HTTPException(status_code=401, detail="Invalid user data")
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/medications/search")
async def search_medications(query: str):
    """Search medications by name with improved matching"""
    if not query or len(query) < 2:
        return {"medications": []}
    
    # Enhanced search implementation with fuzzy matching
    results = []
    query = query.lower()
    
    # First, look for exact matches or starts-with matches (higher priority)
    exact_matches = []
    starts_with = []
    contains = []
    
    for med in MEDICATIONS_DB:
        med_name = med["name"].lower()
        if med_name == query:
            exact_matches.append(med)
        elif med_name.startswith(query):
            starts_with.append(med)
        elif query in med_name:
            contains.append(med)
    
    # Combine results in priority order
    results = exact_matches + starts_with + contains
    
    # Add common medication variations if we don't have enough results
    if len(results) < 3:
        if len(query) >= 3:  # Only add generated results for meaningful queries
            for suffix in ["XR", "SR", "CR", "ER"]:
                results.append({
                    "id": 1000 + len(results),
                    "name": f"{query.capitalize()} {suffix}",
                    "common_dosages": ["5mg", "10mg", "20mg", "50mg", "100mg"],
                    "category": "Generated Result"
                })
            
            # Add a generic form if query might be a brand name
            if not any(x in query.lower() for x in ["acid", "sodium", "hydrochloride"]):
                results.append({
                    "id": 1000 + len(results),
                    "name": f"{query.capitalize()}",
                    "common_dosages": ["10mg", "25mg", "50mg", "100mg"],
                    "category": "Generated Result"
                })
    
    # Add a more extensive medication database for common medications
    additional_meds = [
        {"name": "Paracetamol", "common_dosages": ["500mg", "650mg"], "category": "Analgesic"},
        {"name": "Cetirizine", "common_dosages": ["5mg", "10mg"], "category": "Antihistamine"},
        {"name": "Losartan", "common_dosages": ["25mg", "50mg", "100mg"], "category": "ARB"},
        {"name": "Clopidogrel", "common_dosages": ["75mg"], "category": "Antiplatelet"},
        {"name": "Fluoxetine", "common_dosages": ["10mg", "20mg", "40mg"], "category": "SSRI"},
        {"name": "Diazepam", "common_dosages": ["2mg", "5mg", "10mg"], "category": "Benzodiazepine"},
        {"name": "Gabapentin", "common_dosages": ["100mg", "300mg", "400mg", "600mg"], "category": "Anticonvulsant"},
        {"name": "Metoprolol", "common_dosages": ["25mg", "50mg", "100mg"], "category": "Beta Blocker"}
    ]
    
    # Add medications from the extended list if they match the search
    for med in additional_meds:
        if query in med["name"].lower() and not any(r["name"] == med["name"] for r in results):
            med["id"] = 2000 + len(results)
            results.append(med)
    
    return {"medications": results[:10]}  # Limit to 10 results to avoid overwhelming the UI

@app.get("/api/prescription/{patient_id}/{prescription_id}")
async def get_prescription_details(patient_id: str, prescription_id: str):
    """Get details of a specific prescription"""
    try:
        # Use username directly as the prescription stream name
        prescription_stream = f"{patient_id}"
        
        # Check if stream exists
        stream_exists = multichain_request(
            "liststreams",
            [prescription_stream]
        )
        
        if "result" not in stream_exists or not stream_exists["result"]:
            raise HTTPException(status_code=404, detail=f"No prescriptions found for patient {patient_id}")
        
        # Get the specified prescription
        prescription_item = multichain_request(
            "liststreamkeyitems",
            [prescription_stream, prescription_id]
        )
        
        if "result" not in prescription_item or not prescription_item["result"]:
            raise HTTPException(status_code=404, detail=f"Prescription {prescription_id} not found")
        
        # Get prescription data
        try:
            latest_data = prescription_item["result"][0]
            prescription_data = json.loads(bytes.fromhex(latest_data["data"]).decode('utf-8'))
            
            return {
                "success": True,
                "prescription": prescription_data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error parsing prescription data: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patient-prescriptions/{patient_id}")
async def get_patient_prescriptions(patient_id: str):
    """Get all prescriptions for a patient, for the patient's view"""
    try:
        # Use patient_id as the prescription stream name
        prescription_stream = f"{patient_id}"
        
        # Check if stream exists
        stream_exists = multichain_request(
            "liststreams",
            [prescription_stream]
        )
        
        # If stream doesn't exist or is empty, return empty array instead of 404
        if "result" not in stream_exists or not stream_exists["result"] or len(stream_exists["result"]) == 0:
            print(f"No prescription stream found for patient {patient_id}")
            return {
                "success": True,
                "prescriptions": []
            }
        
        # Subscribe to the stream first to ensure we can access it
        try:
            multichain_request(
                "subscribe",
                [prescription_stream]
            )
        except Exception as e:
            # Might already be subscribed, which is fine
            print(f"Stream subscription note: {str(e)}")
            
        # Get all prescriptions for this patient
        items = multichain_request(
            "liststreamitems",
            [prescription_stream]
        )
        
        if "result" not in items:
            return {
                "success": True,
                "prescriptions": []
            }
        
        # Extract prescription data
        prescriptions = []
        for item in items["result"]:
            if "data" in item and item["data"]:
                try:
                    prescription = json.loads(bytes.fromhex(item["data"]).decode('utf-8'))
                    prescriptions.append(prescription)
                except Exception as e:
                    print(f"Error processing prescription: {str(e)}")
                    continue
        
        # Sort by date, newest first
        prescriptions.sort(key=lambda x: x.get("created_at", x.get("date", "")), reverse=True)
        
        return {
            "success": True,
            "prescriptions": prescriptions
        }
            
    except Exception as e:
        print(f"Error getting prescriptions: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty array instead of error for better UX
        return {
            "success": False,
            "message": f"Error fetching prescriptions: {str(e)}",
            "prescriptions": []
        }

@app.post("/api/generate-wellness-plan")
async def generate_wellness_plan(request_data: dict):
    """Generate a personalized wellness plan using Gemini API based on user's health data"""
    try:
        patient_id = request_data.get("patient_id")
        if not patient_id:
            return {
                "success": False,
                "message": "Patient ID is required"
            }
        
        # Fetch user profile data
        user_data = {}
        try:
            # Get user data - first try to get from username directly
            result = multichain_request(
                "liststreamkeyitems",
                [STREAM_NAME, patient_id]
            )
            
            if "result" in result and result["result"]:
                latest_data = result["result"][-1]
                user_data = json.loads(bytes.fromhex(latest_data["data"]).decode('utf-8'))
            else:
                # If not found, try it as email
                email_parts = patient_id.split('@')
                if len(email_parts) > 1:
                    username = email_parts[0]
                    result = multichain_request(
                        "liststreamkeyitems",
                        [STREAM_NAME, username]
                    )
                    if "result" in result and result["result"]:
                        latest_data = result["result"][-1]
                        user_data = json.loads(bytes.fromhex(latest_data["data"]).decode('utf-8'))
                
        except Exception as e:
            print(f"Error fetching user data: {str(e)}")
            
        # Fetch user prescriptions for medical context
        prescriptions = []
        current_medications = []
        try:
            # Use patient_id as the prescription stream name
            prescription_stream = f"{patient_id}"
            
            # Check if stream exists
            stream_exists = multichain_request(
                "liststreams",
                [prescription_stream]
            )
            
            if "result" in stream_exists and stream_exists["result"]:
                # Get all prescriptions for this patient
                items = multichain_request(
                    "liststreamitems",
                    [prescription_stream]
                )
                
                if "result" in items:
                    # Extract prescription data
                    for item in items["result"]:
                        if "data" in item and item["data"]:
                            try:
                                prescription = json.loads(bytes.fromhex(item["data"]).decode('utf-8'))
                                prescriptions.append(prescription)
                                
                                # Extract medications
                                if "medications" in prescription and prescription["medications"]:
                                    for med in prescription["medications"]:
                                        if "medicine" in med and med["medicine"]:
                                            if med["medicine"] not in current_medications:
                                                current_medications.append(med["medicine"])
                            except Exception as e:
                                print(f"Error processing prescription: {str(e)}")
                                continue
        except Exception as e:
            print(f"Error fetching prescriptions: {str(e)}")
        
        # Extract medical conditions
        medical_conditions = user_data.get("medicalIssues", "No medical issues recorded")
        
        # Additional user data
        age = user_data.get("age", "Unknown")
        gender = user_data.get("gender", "Unknown")
        name = user_data.get("name", "Patient")
        
        # Build prompt for Gemini
        prompt = f"""
Create a personalized wellness plan for a patient with the following details:
- Name: {name}
- Age: {age}
- Gender: {gender}
- Medical conditions: {medical_conditions}
- Current medications: {', '.join(current_medications) if current_medications else "None"}

The wellness plan should include:
1. A brief overview of recommended lifestyle based on the patient's conditions
2. Detailed diet plan with specific meal recommendations (breakfast, lunch, dinner, snacks)
3. Exercise recommendations tailored to their health status (including type, duration, and intensity)
4. Lifestyle recommendations (sleep, stress management, etc.)
5. Specific precautions based on their medical conditions and medications

Format the response in JSON with the following structure:
{{
  "overview": "Brief overview text",
  "diet": {{
    "breakfast": ["item1", "item2", "item3"],
    "lunch": ["item1", "item2", "item3"],
    "dinner": ["item1", "item2", "item3"],
    "snacks": ["item1", "item2"]
  }},
  "exercise": [
    {{"activity": "activity name", "duration": "time", "intensity": "low/medium/high", "frequency": "times per week"}}
  ],
  "lifestyle": [
    {{"type": "category", "tip": "specific recommendation"}}
  ],
  "precautions": ["precaution1", "precaution2"]
}}

Ensure the recommendations are specific to the patient's medical conditions and medications.
"""
        
        # Send to Gemini API
        print(f"Calling Gemini API for wellness plan generation for {patient_id}...")
        response = await generate_gemini_response(prompt)
        
        # Parse and validate the JSON response
        try:
            print("Parsing JSON response...")
            wellness_plan = json.loads(response)
            
            # Add metadata
            wellness_plan["patient_id"] = patient_id
            from datetime import datetime
            wellness_plan["generated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Store wellness plan
            try:
                print("Storing wellness plan...")
                await store_wellness_plan(patient_id, wellness_plan)
            except Exception as e:
                print(f"Warning: Failed to store wellness plan: {str(e)}")
            
            return {
                "success": True,
                "message": "Wellness plan generated successfully",
                "plan": wellness_plan
            }
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")
            print(f"Raw response: {response}")
            
            # Use fallback plan
            print("Using fallback wellness plan")
            fallback_plan = json.loads(generate_fallback_wellness_plan())
            fallback_plan["patient_id"] = patient_id
            fallback_plan["generated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            fallback_plan["is_fallback"] = True
            
            # Try to store the fallback plan
            try:
                await store_wellness_plan(patient_id, fallback_plan)
            except Exception as e:
                print(f"Warning: Failed to store fallback plan: {str(e)}")
            
            return {
                "success": True,
                "message": "Using fallback wellness plan due to formatting issues",
                "plan": fallback_plan
            }
            
    except Exception as e:
        print(f"Error generating wellness plan: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return fallback plan on error
        try:
            fallback_plan = json.loads(generate_fallback_wellness_plan())
            fallback_plan["patient_id"] = patient_id
            fallback_plan["generated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            fallback_plan["is_fallback"] = True
            
            return {
                "success": True,
                "message": "Using fallback wellness plan due to an error",
                "plan": fallback_plan
            }
        except:
            return {
                "success": False,
                "message": f"Error generating wellness plan: {str(e)}"
            }

async def generate_gemini_response(prompt):
    """Function to call Gemini API with better JSON extraction"""
    gemini_api_key = "AIzaSyDI1MjHX-tTe7dHr73enLvEXR3jPUXXCbo"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={gemini_api_key}"
    
    data = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 8192
        },
        "systemInstruction": {
            "parts": [
                {
                    "text": "You are a health coach with expertise in creating personalized wellness plans. Create specific, actionable wellness plans based on patient medical data. Be precise and focused on the patient's conditions. Format the output exactly as requested in valid JSON."
                }
            ]
        }
    }
    
    # Using aiohttp (already imported at the top of your file)
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                url,
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=30
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Gemini API error status: {response.status}, response: {error_text[:200]}")
                    return generate_fallback_wellness_plan()
                
                result = await response.json()
                
                if "candidates" in result and len(result["candidates"]) > 0:
                    content = result["candidates"][0]["content"]
                    if "parts" in content and len(content["parts"]) > 0:
                        response_text = content["parts"][0]["text"]
                        
                        # Extract JSON from the response
                        # Look for JSON between triple backticks if present
                        import re
                        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response_text)
                        if json_match:
                            json_content = json_match.group(1).strip()
                            print("Found JSON inside backticks")
                        else:
                            # Look for JSON starting with { and ending with }
                            json_match = re.search(r'(\{[\s\S]*\})', response_text)
                            if json_match:
                                json_content = json_match.group(1).strip()
                                print("Found raw JSON content")
                            else:
                                print("No JSON pattern found, using entire response")
                                json_content = response_text.strip()
                        
                        # Try to parse and validate the JSON
                        try:
                            json.loads(json_content)
                            return json_content
                        except json.JSONDecodeError as e:
                            print(f"Invalid JSON format: {str(e)}")
                            print(f"JSON content excerpt: {json_content[:100]}...")
                            return generate_fallback_wellness_plan()
                
                print("Unexpected Gemini API response structure")
                return generate_fallback_wellness_plan()
                
        except Exception as e:
            print(f"Exception during Gemini API call: {str(e)}")
            return generate_fallback_wellness_plan()

def generate_fallback_wellness_plan():
    """Generate a fallback wellness plan when the API fails"""
    return json.dumps({
        "overview": "This wellness plan focuses on balanced nutrition, moderate exercise, and stress management techniques customized for your health profile.",
        "diet": {
            "breakfast": ["Oatmeal with berries and nuts", "Whole grain toast with avocado", "Greek yogurt with fresh fruit"],
            "lunch": ["Grilled chicken salad with mixed vegetables", "Lentil soup with whole grain bread", "Quinoa bowl with roasted vegetables"],
            "dinner": ["Baked salmon with steamed vegetables", "Lean protein with brown rice and greens", "Vegetable stir-fry with tofu"],
            "snacks": ["Apple slices with almond butter", "Carrot sticks with hummus", "Mixed nuts and dried fruits"]
        },
        "exercise": [
            {"activity": "Walking", "duration": "30 minutes", "intensity": "low", "frequency": "5 times per week"},
            {"activity": "Gentle stretching", "duration": "15 minutes", "intensity": "low", "frequency": "daily"},
            {"activity": "Swimming", "duration": "20 minutes", "intensity": "medium", "frequency": "2-3 times per week"}
        ],
        "lifestyle": [
            {"type": "Sleep", "tip": "Aim for 7-8 hours of quality sleep each night. Keep a consistent sleep schedule."},
            {"type": "Hydration", "tip": "Drink at least 8 glasses of water daily to maintain proper hydration."},
            {"type": "Stress Management", "tip": "Practice deep breathing or meditation for 10 minutes each morning."}
        ],
        "precautions": [
            "Consult with your doctor before starting any new exercise program.",
            "Monitor your blood pressure regularly and report any changes to your healthcare provider.",
            "Take all prescribed medications as directed by your healthcare provider."
        ]
    })

async def store_wellness_plan(patient_id, wellness_plan):
    """Store wellness plan in MultiChain"""
    try:
        # Create a stream name for wellness plans if it doesn't exist
        wellness_stream = f"wellness_plans"
        
        try:
            # Check if stream exists
            stream_exists = multichain_request("liststreams", [wellness_stream])
            if "result" not in stream_exists or not stream_exists["result"]:
                # Create stream if it doesn't exist
                multichain_request(
                    "create",
                    ["stream", wellness_stream, True]
                )
                # Subscribe to the stream
                multichain_request(
                    "subscribe",
                    [wellness_stream]
                )
        except Exception as e:
            # Stream might already exist
            print(f"Note while checking/creating stream: {str(e)}")
        
        # Store the wellness plan in the stream
        multichain_request(
            "publish",
            [
                wellness_stream,
                patient_id,  # Use patient_id as the key
                json.dumps(wellness_plan).encode('utf-8').hex()  # Store as hex
            ]
        )
        
        return True
    except Exception as e:
        print(f"Error storing wellness plan: {str(e)}")
        raise e

@app.get("/api/wellness-plan/{patient_id}")
async def get_wellness_plan(patient_id: str):
    """Get the latest wellness plan for a patient"""
    try:
        wellness_stream = "wellness_plans"
        
        # Check if stream exists
        stream_exists = multichain_request(
            "liststreams",
            [wellness_stream]
        )
        
        if "result" not in stream_exists or not stream_exists["result"]:
            return {
                "success": False,
                "message": "No wellness plans found"
            }
        
        # Subscribe to the stream first to ensure we can access it
        try:
            multichain_request(
                "subscribe",
                [wellness_stream]
            )
        except Exception as e:
            # Might already be subscribed, which is fine
            pass
        
        # Get the latest wellness plan for this patient
        items = multichain_request(
            "liststreamkeyitems",
            [wellness_stream, patient_id]
        )
        
        if "result" not in items or not items["result"]:
            return {
                "success": False,
                "message": "No wellness plan found for this patient"
            }
        
        # Get the most recent plan (last item)
        latest_plan = items["result"][-1]
        if "data" in latest_plan and latest_plan["data"]:
            try:
                plan_data = json.loads(bytes.fromhex(latest_plan["data"]).decode('utf-8'))
                return {
                    "success": True,
                    "plan": plan_data
                }
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Error parsing wellness plan data: {str(e)}"
                }
        
        return {
            "success": False,
            "message": "Invalid wellness plan data"
        }
            
    except Exception as e:
        print(f"Error getting wellness plan: {str(e)}")
        return {
            "success": False,
            "message": f"Error retrieving wellness plan: {str(e)}"
        }

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)