const { execute } = require('./db');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('Seeding BloodConnect MySQL Database...');

  try {
    // Password hash for 'password123'
    const hashedPassword = bcrypt.hashSync('password123', 10);

    // Clear existing tables
    await execute('DELETE FROM Notifications');
    await execute('DELETE FROM DonationCamps');
    await execute('DELETE FROM BloodStock');
    await execute('DELETE FROM BloodRequests');
    await execute('DELETE FROM Recipients');
    await execute('DELETE FROM Donors');
    await execute('DELETE FROM BloodBanks');
    await execute('DELETE FROM Users');

    // Insert Users
    const users = [
      // Admins
      ['System Admin', 'admin@bloodconnect.org', hashedPassword, '+91 9876543210', 'admin', 'Delhi', 'New Delhi', '110001'],
      // Donors
      ['Rajesh Sharma', 'rajesh.donor@gmail.com', hashedPassword, '+91 9811223344', 'donor', 'Maharashtra', 'Mumbai', '400001'],
      ['Priya Patel', 'priya.patel@gmail.com', hashedPassword, '+91 9822334455', 'donor', 'Gujarat', 'Ahmedabad', '380001'],
      ['Amitabh Varma', 'amitabh.v@gmail.com', hashedPassword, '+91 9833445566', 'donor', 'Karnataka', 'Bengaluru', '560001'],
      ['Sunita Rao', 'sunita.rao@gmail.com', hashedPassword, '+91 9844556677', 'donor', 'Delhi', 'New Delhi', '110016'],
      ['Vikram Singh', 'vikram.singh@gmail.com', hashedPassword, '+91 9855667788', 'donor', 'Telangana', 'Hyderabad', '500001'],
      ['Ananya Sen', 'ananya.sen@gmail.com', hashedPassword, '+91 9866778899', 'donor', 'West Bengal', 'Kolkata', '700001'],
      ['Karthik Reddy', 'karthik.r@gmail.com', hashedPassword, '+91 9877889900', 'donor', 'Tamil Nadu', 'Chennai', '600001'],
      ['Meera Nair', 'meera.nair@gmail.com', hashedPassword, '+91 9888990011', 'donor', 'Kerala', 'Kochi', '682001'],
      // Recipients
      ['Rohan Malhotra', 'rohan.recipient@gmail.com', hashedPassword, '+91 9911223344', 'recipient', 'Maharashtra', 'Mumbai', '400050'],
      ['Kavita Deshmukh', 'kavita.d@gmail.com', hashedPassword, '+91 9922334455', 'recipient', 'Karnataka', 'Bengaluru', '560034'],
      // Blood Banks
      ['Red Cross Central Blood Bank', 'central@redcrossblood.org', hashedPassword, '+91 1123716441', 'blood_bank', 'Delhi', 'New Delhi', '110001'],
      ['Rotary TTK Blood Bank', 'contact@rotaryttkblood.org', hashedPassword, '+91 8025281055', 'blood_bank', 'Karnataka', 'Bengaluru', '560008'],
      ['Lions Blood Bank Mumbai', 'help@lionsbloodmumbai.org', hashedPassword, '+91 2228325678', 'blood_bank', 'Maharashtra', 'Mumbai', '400069'],
      ['Sanjeevani Blood Centre', 'info@sanjeevaniblood.org', hashedPassword, '+91 4023351234', 'blood_bank', 'Telangana', 'Hyderabad', '500034']
    ];

    for (const user of users) {
      await execute(
        `INSERT INTO Users (full_name, email, password_hash, phone, role, state, city, pincode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        user
      );
    }

    // Insert Donors
    const donorDetails = [
      [2, 'O+', 28, 'Male', 72.5, '2026-05-10', 1, 'Andheri West, Near Metro Station', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 5],
      [3, 'A+', 25, 'Female', 58.0, '2026-04-15', 1, 'Navrangpura, Near University', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', 3],
      [4, 'B+', 32, 'Male', 80.0, '2026-06-01', 1, 'Indiranagar, 100ft Road', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 8],
      [5, 'AB+', 29, 'Female', 62.0, '2026-03-20', 0, 'Hauz Khas Enclave', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 4],
      [6, 'O-', 35, 'Male', 76.0, '2026-05-25', 1, 'Banjara Hills, Road No. 12', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 12],
      [7, 'A-', 26, 'Female', 54.0, '2026-02-14', 1, 'Salt Lake Sector 5', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', 2],
      [8, 'B-', 31, 'Male', 74.0, '2026-04-05', 1, 'T. Nagar, Near Bus Terminus', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', 6],
      [9, 'AB-', 27, 'Female', 56.5, '2026-01-10', 1, 'Marine Drive, Fort Kochi', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150', 1]
    ];

    for (const donor of donorDetails) {
      await execute(
        `INSERT INTO Donors (user_id, blood_group, age, gender, weight, last_donation_date, is_available, address, profile_pic, total_donations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        donor
      );
    }

    // Insert Recipients
    await execute(
      `INSERT INTO Recipients (user_id, emergency_contact, relationship_to_patient) VALUES (?, ?, ?)`,
      [10, '+91 9911223399', 'Brother']
    );
    await execute(
      `INSERT INTO Recipients (user_id, emergency_contact, relationship_to_patient) VALUES (?, ?, ?)`,
      [11, '+91 9922334488', 'Self']
    );

    // Insert Blood Banks
    const bloodBanks = [
      [12, 'Red Cross Central Blood Bank', 'RC-DEL-2021-88', 'Dr. S. K. Gupta', '+91 1123716441', 'central@redcrossblood.org', 'Delhi', 'New Delhi', '1 Red Cross Road, Near Parliament House', '110001', '24/7'],
      [13, 'Rotary TTK Blood Bank', 'KA-BLR-2019-45', 'Ramesh Kumar', '+91 8025281055', 'contact@rotaryttkblood.org', 'Karnataka', 'Bengaluru', '200, New Thippasandra Main Rd, HAL 3rd Stage', '560008', '24/7'],
      [14, 'Lions Blood Bank Mumbai', 'MH-MUM-2018-12', 'Sunil Shah', '+91 2228325678', 'help@lionsbloodmumbai.org', 'Maharashtra', 'Mumbai', 'Lions Club Premises, Andheri East', '400069', '24/7'],
      [15, 'Sanjeevani Blood Centre', 'TS-HYD-2022-99', 'Dr. V. Reddy', '+91 4023351234', 'info@sanjeevaniblood.org', 'Telangana', 'Hyderabad', 'Banjara Hills Rd No 2', '500034', '08:00 AM - 10:00 PM']
    ];

    for (const bank of bloodBanks) {
      await execute(
        `INSERT INTO BloodBanks (user_id, name, license_number, contact_person, phone, email, state, city, full_address, pincode, operating_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bank
      );
    }

    // Insert Blood Stock for Banks
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    for (let bankId = 1; bankId <= 4; bankId++) {
      for (const bg of bloodGroups) {
        let units = Math.floor(Math.random() * 25) + 3;
        if (bg === 'O-' || bg === 'AB-') units = Math.floor(Math.random() * 6) + 1;
        await execute(
          `INSERT INTO BloodStock (blood_bank_id, blood_group, units_available) VALUES (?, ?, ?)`,
          [bankId, bg, units]
        );
      }
    }

    // Insert Blood Requests
    const requests = [
      [10, 'Aarav Malhotra', 'O-', 3, 1, 'Lilavati Hospital', 'Bandram Reclamation, Bandra West', 'Mumbai', 'Maharashtra', 'Critical', 'Pending', '+91 9911223344', '2026-08-08'],
      [11, 'Kavita Deshmukh', 'B+', 2, 2, 'Manipal Hospital', 'Old Airport Road', 'Bengaluru', 'Karnataka', 'Standard', 'Fulfilled', '+91 9922334455', '2026-08-04'],
      [2, 'Sneha Sharma', 'A+', 2, 0, 'AIIMS Hospital', 'Ansari Nagar', 'New Delhi', 'Delhi', 'Urgent', 'In Progress', '+91 9811223344', '2026-08-09'],
      [6, 'Kiran Kumar', 'AB-', 1, 0, 'Apollo Hospital', 'Jubilee Hills', 'Hyderabad', 'Telangana', 'Critical', 'Pending', '+91 9855667788', '2026-08-06']
    ];

    for (const req of requests) {
      await execute(
        `INSERT INTO BloodRequests (requester_id, patient_name, blood_group, units_needed, units_fulfilled, hospital_name, hospital_address, city, state, urgency_level, status, contact_number, required_by_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        req
      );
    }

    // Insert Donation Camps
    const camps = [
      [1, 'Indian Red Cross Society', 'Mega Independence Day Blood Donation Camp', '2026-08-15', '09:00 AM', '05:00 PM', 'Red Cross Bhawan, Golf Links', 'New Delhi', 'Delhi', 200, 48, 'Upcoming'],
      [2, 'Rotary Club Bengaluru', 'Corporate Blood Drive 2026', '2026-08-18', '10:00 AM', '04:00 PM', 'Tech Park Amphitheatre, Whitefield', 'Bengaluru', 'Karnataka', 150, 32, 'Upcoming'],
      [3, 'Lions Club International', 'Save Lives Today - Open Camp', '2026-08-20', '08:30 AM', '03:30 PM', 'Azad Maidan, Fort', 'Mumbai', 'Maharashtra', 300, 115, 'Upcoming'],
      [4, 'Sanjeevani Foundation', 'Youth Blood Warriors Camp', '2026-08-22', '09:00 AM', '04:00 PM', 'Osmania University Ground', 'Hyderabad', 'Telangana', 180, 20, 'Upcoming']
    ];

    for (const camp of camps) {
      await execute(
        `INSERT INTO DonationCamps (blood_bank_id, organizer_name, camp_title, date, time_start, time_end, venue_address, city, state, expected_donors, registered_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        camp
      );
    }

    // Insert Notifications
    const notifications = [
      [2, 'Urgent O- Blood Needed', 'Critical requirement for 3 units of O- blood at Lilavati Hospital, Mumbai.', 'alert', 0],
      [3, 'Upcoming Camp Alert', 'You are registered for Independence Day Camp in New Delhi on 15th Aug.', 'camp', 0],
      [10, 'Request Status Updated', 'Your request #1 for Aarav Malhotra has received 1 donor pledge.', 'info', 1]
    ];

    for (const n of notifications) {
      await execute(
        `INSERT INTO Notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?)`,
        n
      );
    }

    console.log('Database successfully seeded with realistic sample data!');
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
