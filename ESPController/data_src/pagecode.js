const INTERNALWARNINGCODE = {
    NoWarning: 0,
    ModuleInconsistantBypassVoltage: 1,
    ModuleInconsistantBypassTemperature: 2
}
Object.freeze(INTERNALWARNINGCODE);

const INTERNALERRORCODE =
{
    NoError: 0,
    CommunicationsError: 1,
    ModuleCountMismatch: 2,
    TooManyModules: 3,
    WaitingForModulesToReply: 4,
    ZeroVoltModule: 5

};
Object.freeze(INTERNALERRORCODE);

function identifyModule(button, cellid) {
    $.getJSON("identifyModule.json", { c: cellid }, function (data) { }).fail(function () { $("#iperror").show(); });
}

function configureModule(button, cellid, attempts) {
    $('#loading').show();

    //Select correct row in table
    $(button).parent().parent().parent().find(".selected").removeClass("selected");
    $(button).parent().parent().addClass("selected");

    $.getJSON("modules.json", { c: cellid },
        function (data) {
            var div = $("#settingConfig .settings");
            $('#c').val(data.settings.id);

            if (data.settings.Cached == true) {
                var currentReading = parseFloat($("#modulesRows > tr.selected > td:nth-child(3)").text());
                $("#ActualVoltage").val(currentReading.toFixed(3));

                $("#settingConfig h2").html("Settings for module bank:" + data.settings.bank + " module:" + data.settings.module);

                //Populate settings div
                $('#ModuleId').val(data.settings.id);
                $('#Version').val(data.settings.ver);
                $('#BypassOverTempShutdown').val(data.settings.BypassOverTempShutdown);
                $('#BypassThresholdmV').val(data.settings.BypassThresholdmV);
                $('#Calib').val(data.settings.Calib.toFixed(4));
                $('#ExtBCoef').val(data.settings.ExtBCoef);
                $('#IntBCoef').val(data.settings.IntBCoef);
                $('#LoadRes').val(data.settings.LoadRes.toFixed(2));
                $('#mVPerADC').val(data.settings.mVPerADC.toFixed(2));

                $("#settingConfig").show();
                $('#loading').hide();
            } else {
                //Data not ready yet, we will have to try again soon
                $('#settingConfig').hide();

                if (attempts > 0) {
                    //Call back to refresh page, only try for a limited number of attempts
                    attempts--;
                    setTimeout(configureModule, 1500, button, bank, module, attempts);
                }
            }
        }).fail(function () {
            $("#iperror").show();
        });
}

function queryBMS() {
    $.getJSON("monitor2.json", function (jsondata) {
        var labels = [];
        var cells = [];
        var bank = [];
        var voltages = [];
        var voltagesmin = [];
        var voltagesmax = [];
        var tempint = [];
        var tempext = [];
        var pwm = [];

        var badpktcount = [];

        var minVoltage = DEFAULT_GRAPH_MIN_VOLTAGE;
        var maxVoltage = DEFAULT_GRAPH_MAX_VOLTAGE;

        var bankNumber = 0;
        var cellsInBank = 0;

        if (jsondata.voltages) {
            for (let i = 0; i < jsondata.voltages.length; i++) {
                labels.push(bankNumber + "/" + i);

                var color = jsondata.bypass[i] == 1 ? "#B44247" : null;

                var v = (parseFloat(jsondata.voltages[i]) / 1000.0);
                voltages.push({ value: v, itemStyle: { color: color } });

                //Auto scale graph is outside of normal bounds
                if (v > maxVoltage) { maxVoltage = v; }
                if (v < minVoltage) { minVoltage = v; }

                voltagesmin.push((parseFloat(jsondata.minvoltages[i]) / 1000.0));
                voltagesmax.push((parseFloat(jsondata.maxvoltages[i]) / 1000.0));

                bank.push(bankNumber);
                cells.push(i);

                badpktcount.push(jsondata.badpacket[i]);

                cellsInBank++;
                if (cellsInBank == jsondata.seriesmodules) {
                    cellsInBank = 0;
                    bankNumber++;
                }

                color = jsondata.bypasshot[i] == 1 ? "#B44247" : null;
                tempint.push({ value: jsondata.inttemp[i], itemStyle: { color: color } });
                tempext.push({ value: (jsondata.exttemp[i] == -40 ? 0 : jsondata.exttemp[i]) });
                pwm.push({ value: jsondata.bypasspwm[i] == 0 ? null : jsondata.bypasspwm[i] });
            }
        }

        //Scale down for low voltages
        if (minVoltage < 2.5) { minVoltage = 0; }

        if (jsondata) {
            //Ignore and hide any errors which are zero
            if (jsondata.badcrc == 0) { $("#badcrc").hide(); } else { $("#badcrc .v").html(jsondata.badcrc); $("#badcrc").show(); }
            if (jsondata.ignored == 0) { $("#ignored").hide(); } else { $("#ignored .v").html(jsondata.ignored); $("#ignored").show(); }
            if (jsondata.sent == 0) { $("#sent").hide(); } else { $("#sent .v").html(jsondata.sent); $("#sent").show(); }
            if (jsondata.received == 0) { $("#received").hide(); } else { $("#received .v").html(jsondata.received); $("#received").show(); }
            if (jsondata.roundtrip == 0) { $("#roundtrip").hide(); } else { $("#roundtrip .v").html(jsondata.roundtrip); $("#roundtrip").show(); }
            if (jsondata.oos == 0) { $("#oos").hide(); } else { $("#oos .v").html(jsondata.oos); $("#oos").show(); }
        }

        if (jsondata.bankv) {
            for (var bankNumber = 0; bankNumber < jsondata.bankv.length; bankNumber++) {
                $("#voltage" + (bankNumber + 1) + " .v").html( (parseFloat(jsondata.bankv[bankNumber]) / 1000.0).toFixed(2) + "V");
                $("#range" + (bankNumber + 1) + " .v").html(jsondata.voltrange[bankNumber] + "mV");
                $("#voltage" + (bankNumber + 1)).show();
                $("#range" + (bankNumber + 1)).show();
            }

            for (var bankNumber = jsondata.bankv.length; bankNumber < MAXIMUM_NUMBER_OF_BANKS; bankNumber++) {
                $("#voltage" + (bankNumber + 1)).hide();
                $("#range" + (bankNumber + 1)).hide();
            }
        }

        //Not currently supported
        if (jsondata.current) {
            if (jsondata.current[0] == null) {
                $("#current").hide();
            } else {
                $("#current .v").html((parseFloat(jsondata.current[0]) / 1000.0).toFixed(2));
                $("#current").show();
            }
        }

        switch (jsondata.warningcode) {
            case INTERNALWARNINGCODE.NoWarning:
                $(".warning").hide();
                break;
            case INTERNALWARNINGCODE.ModuleInconsistantBypassVoltage:
                $(".warning").hide();
                $("#warning1").show();
                break;
            case INTERNALWARNINGCODE.ModuleInconsistantBypassTemperature:
                $(".warning").hide();
                $("#warning2").show();
                break;
            default:
                $(".warning").hide();
                $("#genericwarning").show();
                $("#genericwarningcode").html(jsondata.warningcode);
                break;
        }

        switch (jsondata.errorcode) {
            case INTERNALERRORCODE.NoError:
                $(".error").hide();
                $("#homePage").css({ opacity: 1.0 });
                break;

            case INTERNALERRORCODE.CommunicationsError:
                $("#commserr").show();
                //Dim the main home page graph
                $("#homePage").css({ opacity: 0.1 });
                break;

            case INTERNALERRORCODE.ModuleCountMismatch:
                $("#missingmodules").show();
                $("#missingmodule1").html(jsondata.modulesfnd);
                $("#missingmodule2").html(jsondata.banks * jsondata.seriesmodules);
                break;

            case INTERNALERRORCODE.TooManyModules:
                $("#toomanymodules").show();
                break;

            case INTERNALERRORCODE.TooManyModules:
                $("#genericerrcode").html(jsondata.errorcode);
                $("#genericerror").show();
                break;

            case INTERNALERRORCODE.ZeroVoltModule:
                $("#genericerrcode").html(jsondata.errorcode);
                $("#genericerror").show();
                break;
        }

        $("#info").show();
        $("#iperror").hide();

        if ($('#modulesPage').is(':visible')) {
            var tbody = $("#modulesRows");

            if ($('#modulesRows tr').length != cells.length) {
                $("#settingConfig").hide();

                //Add rows if they dont exist (or incorrect amount)
                $(tbody).find("tr").remove();

                $.each(cells, function (index, value) {
                    $(tbody).append("<tr><td>"
                        + bank[index]
                        + "</td><td>" + value + "</td><td></td><td class='hide'></td><td class='hide'></td>"
                        + "<td class='hide'></td><td class='hide'></td><td class='hide'></td><td class='hide'></td>"
                        + "<td><button type='button' onclick='return identifyModule(this," + index + ");'>Identify</button>"
                        + "<button type='button' onclick='return configureModule(this," + index + ",10);'>Configure</button></td></tr>")
                });
            }

            var rows = $(tbody).find("tr");

            $.each(cells, function (index, value) {
                var columns = $(rows[index]).find("td");
                $(columns[2]).html(voltages[index].value.toFixed(3));
                $(columns[3]).html(voltagesmin[index].toFixed(3));
                $(columns[4]).html(voltagesmax[index].toFixed(3));
                $(columns[5]).html(tempint[index].value);
                $(columns[6]).html(tempext[index].value);
                $(columns[7]).html(pwm[index].value);
                $(columns[8]).html(badpktcount[index]);
            });
        }


        if ($('#homePage').is(':visible')) {
            if (window.g1 == null) {
                try {
                    // based on prepared DOM, initialize echarts instance
                    window.g1 = echarts.init(document.getElementById('graph1'));
                }
                catch (err) {
                    $("#jslibrary").show();
                }

                // specify chart configuration item and data
                var option = {
                    tooltip: {
                        show: true,
                        axisPointer: {
                            type: 'cross',
                            label: {
                                backgroundColor: '#6a7985'
                            }
                        }
                    },
                    legend: {
                        show: false
                    },
                    xAxis: [{
                        gridIndex: 0,
                        type: 'category',
                        axisLine: {
                            lineStyle: {
                                color: '#c1bdbd'
                            }
                        }
                    }, {
                        gridIndex: 1,
                        type: 'category',
                        axisLine: {
                            lineStyle: {
                                color: '#c1bdbd'
                            }
                        }
                    }],
                    yAxis: [{
                        id: 0,
                        gridIndex: 0,
                        name: 'Volts',
                        type: 'value',
                        min: 2.5,
                        max: 4.5,
                        interval: 0.25,
                        position: 'left',
                        axisLine: {
                            lineStyle: {
                                color: '#c1bdbd'
                            }
                        },
                        axisLabel: {
                            formatter: function (value, index) {
                                return value.toFixed(2);
                            }
                        }
                    },
                    {
                        id: 1,
                        gridIndex: 0,
                        name: 'Bypass',
                        type: 'value',
                        min: 0,
                        max: 100,
                        interval: 10,
                        position: 'right',
                        axisLabel: { formatter: '{value}%' },
                        splitLine: { show: false },
                        axisLine: { lineStyle: { type: 'dotted', color: '#c1bdbd' } },
                        axisTick: { show: false }
                    },
                    {
                        id: 2,
                        gridIndex: 1,
                        name: 'Temperature',
                        type: 'value',
                        interval: 10,
                        position: 'left',
                        axisLine: {
                            lineStyle: {
                                color: '#c1bdbd'
                            }
                        },
                        axisLabel: {
                            formatter: '{value}°C'
                        }
                    }
                    ]
                    ,
                    series: [
                        {
                            xAxisIndex: 0,
                            name: 'Voltage',
                            yAxisIndex: 0,
                            type: 'bar',
                            data: [],
                            itemStyle: {
                                color: '#55a1ea',
                                barBorderRadius: [8, 8, 0, 0]
                            },
                            label: {
                                normal: {
                                    show: true,
                                    position: 'insideBottom',
                                    distance: 10,
                                    align: 'left',
                                    verticalAlign: 'middle',
                                    rotate: 90,
                                    formatter: '{c}V',
                                    fontSize: 24,
                                    color: '#eeeeee',
                                    fontFamily: 'Fira Code'
                                }
                            }
                        }

                        , {
                            xAxisIndex: 0,
                            name: 'Min V',
                            yAxisIndex: 0,
                            type: 'line',
                            data: [],
                            label: {
                                normal: {
                                    show: true,
                                    position: 'bottom',
                                    distance: 5,
                                    formatter: '{c}V',
                                    fontSize: 14,
                                    color: '#eeeeee',
                                    fontFamily: 'Fira Code'
                                }
                            },
                            symbolSize: 16,
                            symbol: ['circle'],
                            itemStyle: {
                                normal: {
                                    color: "#c1bdbd",
                                    lineStyle: {
                                        color: 'transparent'
                                    }
                                }
                            }
                        }


                        , {
                            xAxisIndex: 0,
                            name: 'Max V',
                            yAxisIndex: 0,
                            type: 'line',
                            data: [],
                            label: {
                                normal: {
                                    show: true,
                                    position: 'top',
                                    distance: 5,
                                    formatter: '{c}V',
                                    fontSize: 14,
                                    color: '#c1bdbd',
                                    fontFamily: 'Fira Code'
                                }
                            },
                            symbolSize: 16,
                            symbol: ['arrow'],
                            itemStyle: {
                                normal: {
                                    color: "#c1bdbd",
                                    lineStyle: {
                                        color: 'transparent'
                                    }
                                }
                            }
                        }

                        , {
                            xAxisIndex: 0,
                            name: 'Bypass',
                            yAxisIndex: 1,
                            type: 'line',
                            data: [],
                            label: {
                                normal: {
                                    show: true,
                                    position: 'right',
                                    distance: 5,
                                    formatter: '{c}%',
                                    fontSize: 14,
                                    color: '#f0e400',
                                    fontFamily: 'Fira Code'
                                }
                            },
                            symbolSize: 16,
                            symbol: ['square'],
                            itemStyle: { normal: { color: "#f0e400", lineStyle: { color: 'transparent' } } }
                        }

                        //Temperatures
                        , {
                            xAxisIndex: 1,
                            yAxisIndex: 2,
                            name: 'BypassTemperature',
                            type: 'bar',
                            data: [],
                            itemStyle: {
                                color: '#55a1ea',
                                barBorderRadius: [8, 8, 0, 0]
                            },
                            label: {
                                normal: {
                                    show: true,
                                    position: 'insideBottom',
                                    distance: 8,
                                    align: 'left',
                                    verticalAlign: 'middle',
                                    rotate: 90,
                                    formatter: '{c}°C',
                                    fontSize: 20,
                                    color: '#eeeeee',
                                    fontFamily: 'Fira Code'
                                }
                            }
                        }

                        , {
                            xAxisIndex: 1,
                            yAxisIndex: 2,
                            name: 'CellTemperature',
                            type: 'bar',
                            data: [],
                            itemStyle: {
                                color: '#55a1ea',
                                barBorderRadius: [8, 8, 0, 0]
                            },
                            label: {
                                normal: {
                                    show: true,
                                    position: 'insideBottom',
                                    distance: 8,
                                    align: 'left',
                                    verticalAlign: 'middle',
                                    rotate: 90,
                                    formatter: '{c}°C',
                                    fontSize: 20,
                                    color: '#eeeeee',
                                    fontFamily: 'Fira Code'
                                }
                            }

                        }
                    ],
                    grid: [
                        {
                            containLabel: false,
                            left: '4%',
                            right: '4%',
                            bottom: '30%'

                        }, {
                            containLabel: false,
                            left: '4%',
                            right: '4%',
                            top: '76%'
                        }]
                };

                // use configuration item and data specified to show chart
                g1.setOption(option);
            }


            if (g1 != null) {
                g1.setOption({
                    xAxis: { data: labels },
                    yAxis: [{ gridIndex: 0, min: minVoltage, max: maxVoltage }]
                    , series: [{ name: 'Voltage', data: voltages }
                        , { name: 'Min V', data: voltagesmin }
                        , { name: 'Max V', data: voltagesmax }
                        , { name: 'Bypass', data: pwm }
                        , { name: 'BypassTemperature', data: tempint }
                        , { name: 'CellTemperature', data: tempext }]
                });
            }
        }//end homepage visible

        //Call again in a few seconds
        setTimeout(queryBMS, 4000);

        $("#loading").hide();

    }).fail(function () {
        $("#iperror").show();
        //Try again in a few seconds (2 seconds if errored)
        setTimeout(queryBMS, 2000);
        $("#loading").hide();
        //Dim the main home page graph
        $("#homePage").css({ opacity: 0.1 });
    });
}

$(window).on('resize', function () { if (g1 != null && g1 != undefined && $('#homePage').is(':visible')) { g1.resize(); } });

$(function () {
    $("#loading").show();

    //Populate all the setting rules with relay select lists
    $.each($(".settings table tbody tr td:empty"), function (index, value) {
        $.each([1, 2, 3, 4], function (index1, relay) {
            $(value).append('<select id="rule' + (index + 1) + 'relay' + relay + '" name="rule' + (index + 1) + 'relay' + relay + '"><option>On</option><option>Off</option><option>X</option></select>');
        });
    }
    );

    for (var n = 1; n <= 32; n++) {
        $("#totalSeriesModules").append('<option>' + n + '</option>')
    }
    for (var n = 1; n <= MAXIMUM_NUMBER_OF_BANKS; n++) {
        $("#totalBanks").append('<option>' + n + '</option>')
        $("#voltages").append('<div id="voltage' + n + '" class="stat"><span class="x t">Voltage ' + n + ':</span><span class="x v"></span></div>');
        $("#ranges").append('<div id="range' + n + '" class="stat"><span class="x t">Range ' + n + ':</span><span class="x v"></span></div>');
    }

    

    $('#CalculateCalibration').click(function () {
        var currentReading = parseFloat($("#modulesRows > tr.selected > td:nth-child(3)").text());
        var currentCalib = parseFloat($("#Calib").val());
        var actualV = parseFloat($("#ActualVoltage").val());
        var result = (currentCalib / currentReading) * actualV;
        $("#Calib").val(result.toFixed(4));
        return true;
    });

    $("#home").click(function () {
        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();
        $("#homePage").show();
        return true;
    });

    $("#about").click(function () {
        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();

        $.getJSON("settings.json",
            function (data) {
                $("#platformversion").text(data.settings.Version);

                $("#aboutPage").show();
            }).fail(function () { }
            );

        return true;
    });

    $("#modules").click(function () {
        $("#loading").show();

        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();

        //Remove existing table
        $("#modulesRows").find("tr").remove();

        $("#settingConfig").hide();

        $.getJSON("settings.json",
            function (data) {
                $("#g1").val(data.settings.bypassovertemp);
                $("#g2").val(data.settings.bypassthreshold);

                $("#modulesPage").show();
            }).fail(function () { }
            );
        return true;
    });

    $("#settings").click(function () {
        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();

        $("#banksForm").hide();
        $("#settingsPage").show();

        $("#VoltageHigh").val(DEFAULT_GRAPH_MAX_VOLTAGE.toFixed(2));
        $("#VoltageLow").val(DEFAULT_GRAPH_MIN_VOLTAGE.toFixed(2));

        $.getJSON("settings.json",
            function (data) {

                $("#NTPServer").val(data.settings.NTPServerName);
                $("#NTPZoneHour").val(data.settings.TimeZone);
                $("#NTPZoneMin").val(data.settings.MinutesTimeZone);
                $("#NTPDST").prop("checked", data.settings.DST);

                var d = new Date(1000 * data.settings.now);
                $("#timenow").html(d.toJSON());

                $("#totalSeriesModules").val(data.settings.totalseriesmodules);
                $("#totalBanks").val(data.settings.totalnumberofbanks);

                $("#banksForm").show();
            }).fail(function () { }
            );

        return true;
    });


    $("#rules").click(function () {
        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();

        $("#rulesForm").hide();
        $("#rulesPage").show();

        $.getJSON("rules.json",
            function (data) {
                //Rules have loaded

                //Default relay settings
                $.each(data.relaydefault, function (index2, value2) {
                    var relay_value = "X";
                    if (value2 === true) { relay_value = "On"; }
                    if (value2 === false) { relay_value = "Off"; }
                    $("#defaultrelay" + (index2 + 1)).val(relay_value);
                });

                //Default relay settings
                $.each(data.relaytype, function (index2, value2) {
                    $("#relaytype" + (index2 + 1)).val(value2);
                });

                $("#minutesnow").html(data.timenow);

                if (data.PCF8574) {
                    $("#PCF8574").hide();
                } else { $("#PCF8574").show(); }

                //Loop through each rule updating the page
                var i = 1;
                var allrules = $(".settings table tbody tr td label");
                $.each(data.rules, function (index, value) {
                    $("#rule" + (index + 1) + "value").val(value.value);
                    $("#rule" + (index + 1) + "hysteresis").val(value.hysteresis);

                    //Highlight rules which are active
                    if (value.triggered) {
                        $(allrules[index]).addClass("triggered")
                    } else {
                        $(allrules[index]).removeClass("triggered")
                    }

                    $(allrules[index]).removeClass("disablerule");

                    $.each(value.relays, function (index2, value2) {
                        var relay_value = "X";
                        if (value2 === true) { relay_value = "On"; }
                        if (value2 === false) { relay_value = "Off"; }

                        $("#rule" + (index + 1) + "relay" + (index2 + 1)).val(relay_value);

                    });
                });

                if (data.ControlState != 0xff) {
                    //Controller is not in running state yet, so some rules are disabled
                    $.each([2, 3, 4, 5, 6, 7], function (index, value) {
                        $(allrules[value]).addClass("disablerule");
                    });
                }

                $("#rulesForm").show();
            }).fail(function () { }
            );

        return true;
    });

    $("#integration").click(function () {
        $(".header-right a").removeClass("active");
        $(this).addClass("active");
        $(".page").hide();
        $("#integrationPage").show();

        $("#mqttForm").hide();
        $("#influxForm").hide();

        $.getJSON("integration.json",
            function (data) {

                $("#mqttEnabled").prop("checked", data.mqtt.enabled);
                $("#mqttTopic").val(data.mqtt.topic);
                $("#mqttServer").val(data.mqtt.server);
                $("#mqttPort").val(data.mqtt.port);
                $("#mqttUsername").val(data.mqtt.username);
                $("#mqttPassword").val("");

                $("#influxEnabled").prop("checked", data.influxdb.enabled);
                $("#influxServer").val(data.influxdb.server);
                $("#influxPort").val(data.influxdb.port);
                $("#influxDatabase").val(data.influxdb.database);
                $("#influxUsername").val(data.influxdb.username);
                $("#influxPassword").val("");

                $("#mqttForm").show();
                $("#influxForm").show();
            }).fail(function () { }
            );

        return true;
    });

    $("form").unbind('submit').submit(function (e) {
        e.preventDefault();

        $.ajax({
            type: $(this).attr('method'),
            url: $(this).attr('action'),
            data: $(this).serialize(),
            success: function (data) {
                $("#savesuccess").show().delay(2000).fadeOut(500);
            },
            error: function (data) {
                $("#saveerror").show().delay(2000).fadeOut(500);
            },
        });
    });

    $("#settingsForm").unbind('submit').submit(function (e) {
        e.preventDefault();

        $.ajax({
            type: $(this).attr('method'),
            url: $(this).attr('action'),
            data: $(this).serialize(),
            success: function (data) {
                $('#settingConfig').hide();
                $("#savesuccess").show().delay(2000).fadeOut(500);
            },
            error: function (data) {
                $("#saveerror").show().delay(2000).fadeOut(500);
            },
        });
    });

    $("#displaySettingForm").unbind('submit').submit(function (e) {
        e.preventDefault();

        $.ajax({
            type: $(this).attr('method'),
            url: $(this).attr('action'),
            data: $(this).serialize(),
            success: function (data) {
                DEFAULT_GRAPH_MAX_VOLTAGE = parseFloat($("#VoltageHigh").val());
                DEFAULT_GRAPH_MIN_VOLTAGE = parseFloat($("#VoltageLow").val());
                $("#savesuccess").show().delay(2000).fadeOut(500);
            },
            error: function (data) {
                $("#saveerror").show().delay(2000).fadeOut(500);
            },
        });
    });

    $("#mqttEnabled").change(function () {
        if ($(this).is(":checked")) {
            $("#mqttForm").removeAttr("novalidate");
        } else {
            $("#mqttForm").attr("novalidate", "");
        }
    });

    $("#influxEnabled").change(function () {
        if ($(this).is(":checked")) {
            $("#influxForm").removeAttr("novalidate");
        } else {
            $("#influxForm").attr("novalidate", "");
        }
    });

    $.ajaxSetup({
        beforeSend: function (xhr, settings) { settings.data += '&xss=' + XSS_KEY; }
    });

    //$(document).ajaxStart(function(){ }); 
    //$(document).ajaxStop(function(){ });

    $("#homePage").show();

    //On page ready
    queryBMS();
});