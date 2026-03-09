The data of the country boundaries over time come from ohm openhistorical maps

2 steps, first: download_data_from_ohm.js (downloads from the web), then import_tiles (puts it into the db)
Then:
UPDATE country_boundaries
SET geom_simple =
    ST_Multi(
        ST_SimplifyPreserveTopology(
            ST_CollectionExtract(
                ST_MakeValid(geom),
                3
            ),
            0.05
        )
    );

To add a simplified version to the db