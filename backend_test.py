import requests
import sys
from datetime import datetime, timedelta
import json
import subprocess
import time

class WouffyAPITester:
    def __init__(self, base_url="https://paseo-live.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.test_user_id = None
        self.test_walker_id = None
        self.test_walk_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def create_test_user_and_session(self):
        """Create a test user and session in MongoDB"""
        print("🔧 Creating test user and session in MongoDB...")
        
        current_time = int(datetime.now().timestamp())
        user_id = f"test-user-{current_time}"
        session_token = f"test_session_{current_time}"
        
        # MongoDB script to create test data
        mongo_script = f"""
use('test_database');
var userId = '{user_id}';
var sessionToken = '{session_token}';
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{current_time}@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: null,
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  session_id: '{user_id}_session',
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
        """
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Test user created successfully")
                self.token = session_token
                self.test_user_id = user_id
                return True
            else:
                print(f"❌ MongoDB script failed: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Error creating test user: {str(e)}")
            return False

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("🧹 Cleaning up test data...")
        try:
            cleanup_script = """
use('test_database');
db.users.deleteMany({email: /test\\.user\\./});
db.user_sessions.deleteMany({session_token: /test_session/});
db.walks.deleteMany({owner_user_id: /test-user-/});
db.walker_profiles.deleteMany({user_id: /test-user-/});
print('Test data cleaned up');
            """
            subprocess.run(['mongosh', '--eval', cleanup_script], 
                         capture_output=True, text=True, timeout=30)
        except Exception as e:
            print(f"⚠️ Error cleaning up: {str(e)}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        cookies = {}
        
        if self.token:
            # Try both cookie and header auth
            cookies['session_token'] = self.token
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        print(f"   Token: {self.token[:20] if self.token else 'None'}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, cookies=cookies)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("🔐 TESTING AUTHENTICATION ENDPOINTS")
        print("="*50)
        
        # Test /auth/me
        success, user_data = self.run_test(
            "Get current user",
            "GET", 
            "auth/me", 
            200
        )
        
        if success and user_data:
            print(f"   User data: {json.dumps(user_data, indent=2)[:200]}...")
        
        # Test role update (set to OWNER first) - fix request format
        success, _ = self.run_test(
            "Update user role to OWNER",
            "PATCH", 
            "auth/role", 
            200,
            data={"role": "OWNER"}
        )
        
        # Verify role update
        success, user_data = self.run_test(
            "Verify role update",
            "GET", 
            "auth/me", 
            200
        )
        if success and user_data.get('role') == 'OWNER':
            print("   ✅ Role successfully updated to OWNER")
        
        return success

    def test_walkers_endpoints(self):
        """Test walker-related endpoints"""
        print("\n" + "="*50)
        print("👥 TESTING WALKERS ENDPOINTS")
        print("="*50)
        
        # Test get all walkers
        success, walkers_data = self.run_test(
            "Get all walkers",
            "GET", 
            "walkers", 
            200
        )
        
        if success:
            print(f"   Found {len(walkers_data)} walkers")
            if walkers_data:
                self.test_walker_id = walkers_data[0].get('walker_id')
                print(f"   Using walker ID: {self.test_walker_id}")
        
        # Test get walker by ID
        if self.test_walker_id:
            success, walker_data = self.run_test(
                "Get walker by ID",
                "GET", 
                f"walkers/{self.test_walker_id}", 
                200
            )
        
        # Test walkers with filters
        success, _ = self.run_test(
            "Get walkers with rating filter",
            "GET", 
            "walkers?min_rating=4.5", 
            200
        )
        
        success, _ = self.run_test(
            "Get walkers with price filter",
            "GET", 
            "walkers?max_price=1000", 
            200
        )
        
        return success

    def test_walker_profile_endpoints(self):
        """Test walker profile endpoints (requires WALKER role)"""
        print("\n" + "="*50)
        print("🐕 TESTING WALKER PROFILE ENDPOINTS")
        print("="*50)
        
        # Change to WALKER role
        success, _ = self.run_test(
            "Update user role to WALKER",
            "PATCH", 
            "auth/role", 
            200,
            data={"role": "WALKER"}
        )
        
        if not success:
            print("❌ Failed to change role to WALKER, skipping walker profile tests")
            return False
        
        # Test get my walker profile (should return 404 initially)
        success, _ = self.run_test(
            "Get my walker profile (expecting 404)",
            "GET", 
            "walkers/me/profile", 
            404
        )
        
        # Create walker profile
        profile_data = {
            "display_name": "Test Walker",
            "bio": "Test bio for automated testing",
            "experience_years": 3,
            "service_area_text": "Test Area, Buenos Aires",
            "base_location_text": "Test Location",
            "price_per_hour": 800.0,
            "availability_days": ["Lunes", "Martes", "Miércoles"],
            "availability_hours": "9:00 - 17:00",
            "latitude": -34.6037,
            "longitude": -58.3816
        }
        
        success, created_profile = self.run_test(
            "Create walker profile",
            "POST", 
            "walkers/me/profile", 
            200,
            data=profile_data
        )
        
        # Test get my walker profile (should work now)
        success, _ = self.run_test(
            "Get my walker profile",
            "GET", 
            "walkers/me/profile", 
            200
        )
        
        # Test update walker profile
        updated_profile_data = profile_data.copy()
        updated_profile_data["bio"] = "Updated bio for testing"
        updated_profile_data["price_per_hour"] = 900.0
        
        success, _ = self.run_test(
            "Update walker profile",
            "PUT", 
            "walkers/me/profile", 
            200,
            data=updated_profile_data
        )
        
        return success

    def test_walk_endpoints(self):
        """Test walk-related endpoints"""
        print("\n" + "="*50)
        print("🚶 TESTING WALK ENDPOINTS")
        print("="*50)
        
        # Change back to OWNER role
        success, _ = self.run_test(
            "Update user role to OWNER",
            "PATCH", 
            "auth/role", 
            200,
            data={"role": "OWNER"}
        )
        
        if not success:
            print("❌ Failed to change role to OWNER, skipping walk tests")
            return False
        
        # Test get my walks (should be empty initially)
        success, walks_data = self.run_test(
            "Get my walks (empty)",
            "GET", 
            "walks/me", 
            200
        )
        
        # Create pet + walk request
        pet_id = None
        pet_data = {
            "name": "TestDog",
            "species": "DOG",
            "size": "M",
            "notes": "Very friendly dog",
        }
        success, pet_res = self.run_test(
            "Create pet for walk test",
            "POST",
            "me/pets",
            200,
            data=pet_data,
        )
        if success and pet_res:
            pet_id = pet_res.get("pet_id")

        if self.test_walker_id and pet_id:
            future_datetime = datetime.now() + timedelta(days=1, hours=2)
            walk_data = {
                "walker_profile_id": self.test_walker_id,
                "scheduled_start_at": future_datetime.isoformat(),
                "estimated_duration_minutes": 60,
                "start_address_text": "Test Address 123, Buenos Aires",
                "notes": "Test walk request notes",
                "pet_id": pet_id,
            }
            
            success, created_walk = self.run_test(
                "Create walk request",
                "POST", 
                "walks", 
                200,
                data=walk_data
            )
            
            if success and created_walk:
                self.test_walk_id = created_walk.get('walk_id')
                print(f"   Created walk ID: {self.test_walk_id}")
        
        # Test get my walks (should have the created walk)
        success, walks_data = self.run_test(
            "Get my walks (with data)",
            "GET", 
            "walks/me", 
            200
        )
        
        if success:
            print(f"   Found {len(walks_data)} walks")
        
        # Test cancel walk
        if self.test_walk_id:
            success, _ = self.run_test(
                "Cancel walk",
                "PATCH", 
                f"walks/{self.test_walk_id}/cancel", 
                200
            )
        
        return success

    def test_walker_requests_endpoints(self):
        """Test walker incoming requests (requires WALKER role)"""
        print("\n" + "="*50)
        print("📥 TESTING WALKER REQUESTS ENDPOINTS")
        print("="*50)
        
        # Change to WALKER role
        success, _ = self.run_test(
            "Update user role to WALKER",
            "PATCH", 
            "auth/role", 
            200,
            data={"role": "WALKER"}
        )
        
        if not success:
            return False
        
        # Test get incoming walks
        success, incoming_walks = self.run_test(
            "Get incoming walks",
            "GET", 
            "walks/incoming", 
            200
        )
        
        if success:
            print(f"   Found {len(incoming_walks)} incoming walks")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Wouffy API Testing")
        print(f"Base URL: {self.base_url}")
        
        # Setup
        if not self.create_test_user_and_session():
            print("❌ Failed to create test user. Exiting.")
            return 1
        
        try:
            # Run all test suites
            auth_success = self.test_auth_endpoints()
            walkers_success = self.test_walkers_endpoints()
            walker_profile_success = self.test_walker_profile_endpoints()
            walk_success = self.test_walk_endpoints()
            walker_requests_success = self.test_walker_requests_endpoints()
            
            # Print results
            print("\n" + "="*50)
            print("📊 FINAL TEST RESULTS")
            print("="*50)
            print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
            print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            # Test suite results
            print("\nTest Suite Results:")
            print(f"  🔐 Auth endpoints: {'✅' if auth_success else '❌'}")
            print(f"  👥 Walkers endpoints: {'✅' if walkers_success else '❌'}")
            print(f"  🐕 Walker profile endpoints: {'✅' if walker_profile_success else '❌'}")
            print(f"  🚶 Walk endpoints: {'✅' if walk_success else '❌'}")
            print(f"  📥 Walker requests endpoints: {'✅' if walker_requests_success else '❌'}")
            
            return 0 if self.tests_passed == self.tests_run else 1
            
        finally:
            # Cleanup
            self.cleanup_test_data()

def main():
    tester = WouffyAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())