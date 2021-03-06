; generated by PrusaSlicer 2.2.0+win64 on 2021-09-20 at 18:37:32 UTC

; 

; external perimeters extrusion width = 0.45mm
; perimeters extrusion width = 0.45mm
; infill extrusion width = 0.45mm
; solid infill extrusion width = 0.45mm
; top infill extrusion width = 0.40mm
; support material extrusion width = 0.35mm
; first layer extrusion width = 0.42mm

M73 P0 R29
M73 Q0 S29
M201 X1000 Y1000 Z1000 E5000 ; sets maximum accelerations, mm/sec^2
M203 X200 Y200 Z12 E120 ; sets maximum feedrates, mm/sec
M204 P1250 R1250 T1250 ; sets acceleration (P, T) and retract acceleration (R), mm/sec^2
M205 X8.00 Y8.00 Z0.40 E1.50 ; sets the jerk limits, mm/sec
M205 S0 T0 ; sets the minimum extruding and travel feed rate, mm/sec
M107
M190 S75 ; set bed temperature and wait for it to be reached
M104 S215 ; set temperature
M109 S215 ; set temperature and wait for it to be reached
G21 ; set units to millimeters
G90 ; use absolute coordinates
M83 ; use relative distances for extrusion
M900 K30 ; Filament gcode
;BEFORE_LAYER_CHANGE
G92 E0.0
;0.2


G1 Z0.200 F10800.000
;AFTER_LAYER_CHANGE
;0.2
G1 X-3.146 Y-1.621
M204 S1000
G1 F1200.000
G1 X-2.437 Y-2.605 E0.03804
M73 Q0 S29
M73 P0 R29
G1 X-1.490 Y-3.364 E0.03804
G1 X-0.370 Y-3.845 E0.03820
G1 X0.753 Y-4.008 E0.03560
G1 X9.173 Y-4.008 E0.26401
G1 X9.987 Y-3.933 E0.02562
G1 X10.779 Y-3.711 E0.02579
G1 X11.512 Y-3.351 E0.02562
G1 X12.169 Y-2.864 E0.02562
G1 X12.730 Y-2.263 E0.02579
G1 X13.171 Y-1.575 E0.02562
G1 X13.481 Y-0.813 E0.02579
G1 X13.647 Y-0.013 E0.02562
G1 X13.676 Y33.339 E1.04573
G1 X13.568 Y34.312 E0.03070
G1 X13.131 Y35.477 E0.03902
G1 X12.393 Y36.479 E0.03902
G1 X11.413 Y37.238 E0.03886
G1 X10.259 Y37.703 E0.03902
G1 X9.179 Y37.837 E0.03413
G1 X0.779 Y37.837 E0.26335
G1 X-0.152 Y37.728 E0.02939
G1 X-0.833 Y37.518 E0.02234
G1 X-1.467 Y37.206 E0.02218
G1 X-2.046 Y36.799 E0.02218
G1 X-2.557 Y36.302 E0.02234
G1 X-2.983 Y35.731 E0.02234
G1 X-3.312 Y35.105 E0.02218
G1 X-3.540 Y34.429 E0.02235
G1 X-3.658 Y33.732 E0.02218
G1 X-3.676 Y0.490 E1.04230
G1 X-3.568 Y-0.483 E0.03070
G1 X-3.167 Y-1.565 E0.03616
G1 X-2.814 Y-1.432 F10800.000
G1 F1200.000
G1 X-2.136 Y-2.374 E0.03639
G1 X-1.249 Y-3.069 E0.03531
G1 X-0.208 Y-3.498 E0.03531
G1 X0.775 Y-3.631 E0.03110
G1 X9.173 Y-3.631 E0.26331
G1 X9.927 Y-3.561 E0.02374
G1 X10.651 Y-3.356 E0.02358
G1 X11.325 Y-3.023 E0.02358
G1 X11.932 Y-2.570 E0.02374
G1 X12.446 Y-2.014 E0.02374
G1 X12.848 Y-1.378 E0.02358
G1 X13.129 Y-0.675 E0.02374
G1 X13.276 Y0.062 E0.02358
G1 X13.299 Y33.339 E1.04335
G1 X13.198 Y34.240 E0.02844
G1 X12.790 Y35.316 E0.03609
G1 X12.100 Y36.239 E0.03609
G1 X11.184 Y36.935 E0.03609
G1 X10.110 Y37.351 E0.03609
G1 X9.168 Y37.460 E0.02974
G1 X0.787 Y37.460 E0.26279
G1 X-0.079 Y37.358 E0.02734
G1 X-0.702 Y37.164 E0.02045
G1 X-1.287 Y36.875 E0.02045
G1 X-1.822 Y36.494 E0.02060
G1 X-2.287 Y36.037 E0.02045
G1 X-2.675 Y35.513 E0.02045
G1 X-2.977 Y34.929 E0.02060
G1 X-3.181 Y34.310 E0.02045
G1 X-3.285 Y33.666 E0.02045
G1 X-3.299 Y0.490 E1.04022
G1 X-3.198 Y-0.411 E0.02844
G1 X-2.835 Y-1.376 E0.03231
G1 X-2.484 Y-1.243 F10800.000
G1 F1200.000
G1 X-2.461 Y-1.303 E0.00204
G1 X-1.843 Y-2.134 E0.03247
G1 X-1.017 Y-2.767 E0.03261
G1 X-0.054 Y-3.148 E0.03247
G1 X0.789 Y-3.254 E0.02666
G1 X9.173 Y-3.254 E0.26286
G1 X9.863 Y-3.189 E0.02173
G1 X10.525 Y-3.000 E0.02158
G1 X11.141 Y-2.694 E0.02158
G1 X11.691 Y-2.280 E0.02158
G1 X12.156 Y-1.773 E0.02158
G1 X12.523 Y-1.184 E0.02173
G1 X12.776 Y-0.539 E0.02173
G1 X12.905 Y0.137 E0.02158
G1 X12.922 Y33.338 E1.04100
G1 X12.828 Y34.164 E0.02606
G1 X12.451 Y35.149 E0.03306
G1 X11.812 Y35.993 E0.03321
G1 X10.967 Y36.624 E0.03306
G1 X9.975 Y36.995 E0.03321
G1 X9.206 Y37.083 E0.02427
G1 X0.827 Y37.083 E0.26271
G1 X-0.003 Y36.989 E0.02621
G1 X-1.104 Y36.545 E0.03721
G1 X-2.012 Y35.780 E0.03721
G1 X-2.635 Y34.769 E0.03721
G1 X-2.912 Y33.610 E0.03736
G1 X-2.922 Y0.490 E1.03845
G1 X-2.828 Y-0.335 E0.02606
G1 X-2.505 Y-1.187 E0.02855
G1 X-2.121 Y-1.139 F10800.000
G1 F1200.000
G1 X-1.550 Y-1.894 E0.02965
G1 X-0.793 Y-2.460 E0.02965
G1 X0.091 Y-2.795 E0.02965
G1 X0.803 Y-2.877 E0.02245
G1 X9.173 Y-2.877 E0.26243
G1 X9.795 Y-2.818 E0.01962
G1 X10.393 Y-2.647 E0.01947
G1 X10.948 Y-2.370 E0.01947
G1 X11.447 Y-1.992 E0.01962
G1 X11.868 Y-1.529 E0.01962
G1 X12.196 Y-0.996 E0.01962
G1 X12.420 Y-0.412 E0.01962
G1 X12.532 Y0.199 E0.01947
G1 X12.545 Y33.338 E1.03904
G1 X12.459 Y34.085 E0.02358
G1 X12.112 Y34.984 E0.03022
G1 X11.528 Y35.745 E0.03008
G1 X10.753 Y36.311 E0.03008
G1 X9.846 Y36.637 E0.03022
G1 X9.193 Y36.706 E0.02061
G1 X0.827 Y36.706 E0.26229
G1 X0.076 Y36.620 E0.02372
G1 X-0.917 Y36.217 E0.03359
G1 X-1.734 Y35.524 E0.03359
G1 X-2.293 Y34.610 E0.03359
G1 X-2.537 Y33.562 E0.03373
G1 X-2.545 Y0.491 E1.03692
G1 X-2.459 Y-0.256 E0.02358
G1 X-2.142 Y-1.083 E0.02777
G1 X1.042 Y0.710 F10800.000
G1 F1200.000
G1 X8.958 Y0.710 E0.24821
G1 X8.958 Y33.119 E1.01615
G1 X1.042 Y33.119 E0.24821
G1 X1.042 Y0.770 E1.01427
G1 X1.403 Y0.882 F10800.000
G1 X1.419 Y1.087
G1 F1200.000
G1 X8.581 Y1.087 E0.22456
G1 X8.581 Y32.741 E0.99250
G1 X1.419 Y32.741 E0.22456
G1 X1.419 Y1.147 E0.99062
G1 X1.796 Y1.464 F10800.000
G1 F1200.000
G1 X8.204 Y1.464 E0.20091
G1 X8.204 Y32.364 E0.96886
G1 X1.796 Y32.364 E0.20091
G1 X1.796 Y1.524 E0.96697
G1 X2.173 Y1.841 F10800.000
G1 F1200.000
G1 X7.827 Y1.841 E0.17727
G1 X7.827 Y31.987 E0.94521
G1 X2.173 Y31.987 E0.17727
G1 X2.173 Y1.901 E0.94333
G1 X2.550 Y2.218 F10800.000
G1 F1200.000
G1 X7.450 Y2.218 E0.15362
G1 X7.450 Y31.610 E0.92156
G1 X2.550 Y31.610 E0.15362
G1 X2.550 Y2.278 E0.91968
G1 X3.369 Y31.554 F10800.000
G1 F1200.000
M73 Q3 S28
G1 X7.224 Y3.401 E0.01673
G1 X6.267 Y2.445 E0.04243
M73 P3 R28
G1 X6.800 Y2.445 E0.01673
G1 X7.393 Y3.037 E0.02630
M106 S255
;BEFORE_LAYER_CHANGE
G92 E0.0
;0.4


; total filament used [g] = 2.7
; total filament cost = 0.1
; estimated printing time (normal mode) = 28m 46s
; estimated printing time (silent mode) = 28m 46s

; avoid_crossing_perimeters = 0
; bed_custom_model = 
; bed_custom_texture = 
; bed_shape = 0x0,250x0,250x210,0x210
; bed_temperature = 75
; before_layer_gcode = ;BEFORE_LAYER_CHANGE\nG92 E0.0\n;[layer_z]\n\n
; between_objects_gcode = 
; bottom_fill_pattern = rectilinear
; bottom_solid_layers = 5
; bottom_solid_min_thickness = 0
; bridge_acceleration = 1000
; bridge_angle = 0
; bridge_fan_speed = 100
; bridge_flow_ratio = 0.95
; bridge_speed = 30
; brim_width = 0
; clip_multipart_objects = 1
; compatible_printers_condition_cummulative = "printer_notes=~/.*PRINTER_VENDOR_PRUSA3D.*/ and printer_notes=~/.*PRINTER_MODEL_MK3.*/ and nozzle_diameter[0]==0.4";"! (printer_notes=~/.*PRINTER_VENDOR_PRUSA3D.*/ and printer_notes=~/.*PRINTER_MODEL_MK(2.5|3).*/ and single_extruder_multi_material)"
; complete_objects = 0
; cooling = 1
; cooling_tube_length = 5
; cooling_tube_retraction = 91.5
; default_acceleration = 1000
; default_filament_profile = "Prusament PLA"
; default_print_profile = 0.15mm QUALITY MK3
; deretract_speed = 0
; disable_fan_first_layers = 1
; dont_support_bridges = 1
; draft_shield = 0
; duplicate_distance = 6
; elefant_foot_compensation = 0
; end_filament_gcode = "; Filament-specific end gcode"
; end_gcode = G4 ; wait\nM221 S100\nM104 S0 ; turn off temperature\nM140 S0 ; turn off heatbed\nM107 ; turn off fan\n{if layer_z < max_print_height}G1 Z{z_offset+min(layer_z+30, max_print_height)}{endif} ; Move print head up
; ensure_vertical_shell_thickness = 1
; external_perimeter_extrusion_width = 0.45
; external_perimeter_speed = 35
; external_perimeters_first = 1
; extra_loading_move = -2
; extra_perimeters = 0
; extruder_clearance_height = 25
; extruder_clearance_radius = 45
; extruder_colour = ""
; extruder_offset = 0x0
; extrusion_axis = E
; extrusion_multiplier = 1
; extrusion_width = 0.45
; fan_always_on = 1
; fan_below_layer_time = 100
; filament_colour = #FF8000
; filament_cooling_final_speed = 3.4
; filament_cooling_initial_speed = 2.2
; filament_cooling_moves = 4
; filament_cost = 24.99
; filament_density = 1.24
; filament_diameter = 1.75
; filament_load_time = 0
; filament_loading_speed = 28
; filament_loading_speed_start = 3
; filament_max_volumetric_speed = 12.5
; filament_minimal_purge_on_wipe_tower = 15
; filament_notes = "Affordable filament for everyday printing in premium quality manufactured in-house by Josef Prusa"
; filament_ramming_parameters = "120 100 6.6 6.8 7.2 7.6 7.9 8.2 8.7 9.4 9.9 10.0| 0.05 6.6 0.45 6.8 0.95 7.8 1.45 8.3 1.95 9.7 2.45 10 2.95 7.6 3.45 7.6 3.95 7.6 4.45 7.6 4.95 7.6"
; filament_settings_id = PLA
; filament_soluble = 0
; filament_toolchange_delay = 0
; filament_type = PLA
; filament_unload_time = 0
; filament_unloading_speed = 90
; filament_unloading_speed_start = 100
; filament_vendor = (Unknown)
; fill_angle = 45
; fill_density = 100%
; fill_pattern = rectilinear
; first_layer_acceleration = 1000
; first_layer_bed_temperature = 75
; first_layer_extrusion_width = 0.42
; first_layer_height = 0.2
; first_layer_speed = 20
; first_layer_temperature = 215
; gap_fill_speed = 40
; gcode_comments = 0
; gcode_flavor = marlin
; gcode_label_objects = 0
; high_current_on_filament_swap = 0
; host_type = octoprint
; infill_acceleration = 1250
; infill_every_layers = 1
; infill_extruder = 1
; infill_extrusion_width = 0.45
; infill_first = 0
; infill_only_where_needed = 0
; infill_overlap = 40%
; infill_speed = 200
; inherits_cummulative = "0.20mm SPEED MK3";"Prusament PLA";"Original Prusa i3 MK3S"
; interface_shells = 0
; layer_gcode = ;AFTER_LAYER_CHANGE\n;[layer_z]
; layer_height = 0.2
; machine_max_acceleration_e = 5000,5000
; machine_max_acceleration_extruding = 1250,1250
; machine_max_acceleration_retracting = 1250,1250
; machine_max_acceleration_x = 1000,960
; machine_max_acceleration_y = 1000,960
; machine_max_acceleration_z = 1000,1000
; machine_max_feedrate_e = 120,120
; machine_max_feedrate_x = 200,100
; machine_max_feedrate_y = 200,100
; machine_max_feedrate_z = 12,12
; machine_max_jerk_e = 1.5,1.5
; machine_max_jerk_x = 8,8
; machine_max_jerk_y = 8,8
; machine_max_jerk_z = 0.4,0.4
; machine_min_extruding_rate = 0,0
; machine_min_travel_rate = 0,0
; max_fan_speed = 100
; max_layer_height = 0.25
; max_print_height = 210
; max_print_speed = 200
; max_volumetric_speed = 0
; min_fan_speed = 100
; min_layer_height = 0.07
; min_print_speed = 15
; min_skirt_length = 10
; notes = 
; nozzle_diameter = 0.4
; only_retract_when_crossing_perimeters = 0
; ooze_prevention = 0
; output_filename_format = {input_filename_base}_{total_weight}_{print_time}.gcode
; overhangs = 1
; parking_pos_retraction = 92
; perimeter_acceleration = 800
; perimeter_extruder = 1
; perimeter_extrusion_width = 0.45
; perimeter_speed = 60
; perimeters = 5
; post_process = 
; print_settings_id = 0.20mm NIST PPS
; printer_model = MK3S
; printer_notes = Don't remove the following keywords! These keywords are used in the "compatible printer" condition of the print and filament profiles to link the particular print and filament profiles to this printer profile.\nPRINTER_VENDOR_PRUSA3D\nPRINTER_MODEL_MK3\n
; printer_settings_id = Clank FXY NIST
; printer_technology = FFF
; printer_variant = 0.4
; printer_vendor = 
; raft_layers = 0
; remaining_times = 1
; resolution = 0
; retract_before_travel = 1
; retract_before_wipe = 0%
; retract_layer_change = 1
; retract_length = 0
; retract_length_toolchange = 4
; retract_lift = 0.6
; retract_lift_above = 0
; retract_lift_below = 209
; retract_restart_extra = 0
; retract_restart_extra_toolchange = 0
; retract_speed = 35
; seam_position = nearest
; serial_port = 
; serial_speed = 250000
; silent_mode = 1
; single_extruder_multi_material = 0
; single_extruder_multi_material_priming = 0
; skirt_distance = 3
; skirt_height = 2
; skirts = 1
; slice_closing_radius = 0.049
; slowdown_below_layer_time = 20
; small_perimeter_speed = 25
; solid_infill_below_area = 0
; solid_infill_every_layers = 0
; solid_infill_extruder = 1
; solid_infill_extrusion_width = 0.45
; solid_infill_speed = 200
; spiral_vase = 0
; standby_temperature_delta = -5
; start_filament_gcode = "M900 K{if printer_notes=~/.*PRINTER_MODEL_MINI.*/ and nozzle_diameter[0]==0.6}0.12{elsif printer_notes=~/.*PRINTER_MODEL_MINI.*/}0.2{elsif printer_notes=~/.*PRINTER_HAS_BOWDEN.*/}200{elsif nozzle_diameter[0]==0.6}18{else}30{endif} ; Filament gcode"
; start_gcode = 
; support_material = 1
; support_material_angle = 0
; support_material_auto = 1
; support_material_buildplate_only = 1
; support_material_contact_distance = 0.1
; support_material_enforce_layers = 0
; support_material_extruder = 0
; support_material_extrusion_width = 0.35
; support_material_interface_contact_loops = 0
; support_material_interface_extruder = 0
; support_material_interface_layers = 2
; support_material_interface_spacing = 0.2
; support_material_interface_speed = 100%
; support_material_pattern = honeycomb
; support_material_spacing = 1.5
; support_material_speed = 50
; support_material_synchronize_layers = 0
; support_material_threshold = 20
; support_material_with_sheath = 0
; support_material_xy_spacing = 50%
; temperature = 210
; thin_walls = 0
; threads = 12
; thumbnails = 
; toolchange_gcode = 
; top_fill_pattern = rectilinear
; top_infill_extrusion_width = 0.4
; top_solid_infill_speed = 50
; top_solid_layers = 6
; top_solid_min_thickness = 0
; travel_speed = 180
; use_firmware_retraction = 0
; use_relative_e_distances = 1
; use_volumetric_e = 0
; variable_layer_height = 1
; wipe = 1
; wipe_into_infill = 0
; wipe_into_objects = 0
; wipe_tower = 1
; wipe_tower_bridging = 10
; wipe_tower_no_sparse_layers = 0
; wipe_tower_rotation_angle = 0
; wipe_tower_width = 60
; wipe_tower_x = 170
; wipe_tower_y = 125
; wiping_volumes_extruders = 70,70
; wiping_volumes_matrix = 0
; xy_size_compensation = 0
; z_offset = 0
