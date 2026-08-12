const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qlzyfdwrkcxyqapewxwg.supabase.co";
const supabaseKey = "sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTamilNaduWards() {
  try {
    // Get all wards for Tamil Nadu from the map_shapes table
    const { data: tnWards, error: wardError, count } = await supabase
      .from("map_shapes")
      .select("id, name, properties", { count: "exact" })
      .eq("country", "India")
      .eq("boundary_type", "Ward")
      .is("retired_at", null);
    
    if (wardError) {
      console.error("Error fetching wards:", wardError);
      return;
    }

    // Filter for Tamil Nadu wards from properties
    const tnWardsList = tnWards.filter(w => {
      const props = w.properties;
      return props && props.statename && 
        props.statename.toUpperCase().includes("TAMIL") && 
        props.statename.toUpperCase().includes("NADU");
    });

    console.log(`\n📊 Tamil Nadu Municipal Wards Analysis`);
    console.log(`====================================\n`);
    console.log(`Total India wards in system: ${count}`);
    console.log(`Tamil Nadu wards found: ${tnWardsList.length}\n`);

    // Group by district/ULB
    const ulbGroups = {};
    tnWardsList.forEach(ward => {
      const ulbName = ward.properties?.ulbname || "Unknown";
      if (!ulbGroups[ulbName]) {
        ulbGroups[ulbName] = [];
      }
      ulbGroups[ulbName].push(ward);
    });

    console.log(`ULBs (Urban Local Bodies) with wards: ${Object.keys(ulbGroups).length}\n`);
    
    // List top ULBs by ward count
    const ulbStats = Object.entries(ulbGroups)
      .map(([name, wards]) => ({
        name,
        count: wards.length,
        district: wards[0].properties?.districtname || "Unknown"
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    console.log(`Top 20 ULBs by ward count:\n`);
    ulbStats.forEach(ulb => {
      console.log(`  ${ulb.name.padEnd(40)} | ${String(ulb.count).padStart(3)} wards | ${ulb.district}`);
    });

    // Check for Tambaram specifically
    console.log(`\n\nTambaram Search:\n`);
    const tambaram = tnWardsList.filter(w => 
      w.properties?.ulbname?.toLowerCase().includes("tambaram")
    );
    console.log(`  Found: ${tambaram.length} wards in Tambaram`);
    if (tambaram.length > 0) {
      console.log(`  Sample ward: ${tambaram[0].name}`);
    } else {
      console.log(`  ⚠️ Tambaram appears to be MISSING from the dataset!`);
    }

    // Summary statistics
    console.log(`\n\nSummary Statistics:\n`);
    console.log(`  Total TN wards: ${tnWardsList.length}`);
    console.log(`  Average wards per ULB: ${(tnWardsList.length / Object.keys(ulbGroups).length).toFixed(1)}`);
    
    // Get all unique districts
    const districts = new Set(tnWardsList.map(w => w.properties?.districtname));
    console.log(`  Districts covered: ${districts.size}`);
    console.log(`  Districts: ${Array.from(districts).sort().join(", ")}`);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkTamilNaduWards();
